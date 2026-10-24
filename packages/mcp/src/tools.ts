import z from 'zod'
import * as path from '@std/path'
import { type Forager, errors } from '@forager/core'
import type { ToolName } from './config.ts'
import type { TagPolicy } from './tag_policy.ts'
import { decode_cursor, format_group, format_media, format_page, format_tag } from './format.ts'


export interface ToolContext {
  forager: Forager
  editor: string
  overwrite: boolean
  tag_policy: TagPolicy
}

export interface ToolDefinition<Input extends z.ZodType = z.ZodType> {
  description: string
  read_only: boolean
  input: Input
  handler: (ctx: ToolContext, args: z.output<Input>) => unknown
}

function define_tool<Input extends z.ZodType>(tool: ToolDefinition<Input>): ToolDefinition {
  return tool as unknown as ToolDefinition
}


const PAGINATION_DESCRIPTION = 'Results are paginated. When next_cursor is not null, call again with the same arguments and cursor set to next_cursor to fetch the next page.'

const Pagination = {
  limit: z.number().int().min(1).max(100).default(25).describe('Maximum number of results in a page'),
  cursor: z.string().optional().describe('The next_cursor value from a previous response. Omit to fetch the first page'),
}

const TagShorthand = z.string().describe('A tag in "group:name" shorthand (e.g. "genre:drama"). A tag without a group is written as just "name"')

const MediaQuery = z.object({
  tags: TagShorthand.array().optional().describe('Only match media that has every one of these tags'),
  keypoint: TagShorthand.optional().describe('Only match media with a video keypoint tagged with this tag'),
  filepath: z.string().optional().describe('An exact filepath, or a glob (e.g. "/media/photos/*")'),
  media_type: z.enum(['IMAGE', 'VIDEO', 'AUDIO']).optional(),
  animated: z.boolean().optional().describe('Only match animated media (videos, gifs, animated webps)'),
  stars: z.number().int().min(0).max(5).optional(),
  stars_equality: z.enum(['gte', 'eq']).optional().describe('How to compare stars. Defaults to "gte"'),
  unread: z.boolean().optional().describe('Only match media that has never been viewed'),
  duration_min_seconds: z.number().min(0).optional(),
  duration_max_seconds: z.number().min(0).optional(),
}).strict()

type MediaQuery = z.output<typeof MediaQuery>

function core_media_query(query: MediaQuery | undefined) {
  if (query === undefined) return {}
  const { duration_min_seconds, duration_max_seconds, ...fields } = query
  const duration = duration_min_seconds === undefined && duration_max_seconds === undefined
    ? undefined
    : {
      min: duration_min_seconds === undefined ? undefined : {seconds: duration_min_seconds},
      max: duration_max_seconds === undefined ? undefined : {seconds: duration_max_seconds},
    }
  return {...fields, duration}
}

const ThumbnailLimit = z.number().int().min(0).max(20).default(1).describe('Number of thumbnail filepaths to include per result. Thumbnails are jpg files that can be read from disk')

const MediaSortBy = z.enum(['created_at', 'updated_at', 'source_created_at', 'view_count', 'last_viewed_at', 'duration'])
const Order = z.enum(['desc', 'asc'])

const MediaInfo = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  source_url: z.string().optional().describe('Where this media was originally found'),
  source_created_at: z.iso.datetime({offset: true}).transform(timestamp => new Date(timestamp)).optional().describe('ISO 8601 timestamp of when the media was originally created'),
  stars: z.number().int().min(0).max(5).optional(),
  metadata: z.record(z.string(), z.json()).optional().describe('Arbitrary json metadata'),
}).strict()

const TagChanges = z.object({
  add: TagShorthand.array().optional(),
  remove: TagShorthand.array().optional(),
  replace: TagShorthand.array().optional().describe('Replace all of the tags previously written by this editor'),
}).strict()

const AbsoluteFilepath = z.string().refine(filepath => path.isAbsolute(filepath), 'filepath must be an absolute path')

const WRITE_DESCRIPTION = 'Writes are recorded under this server\'s editor. Unless the server is configured to overwrite other editors, media info fields written by other editors are left untouched and tags.replace only replaces tags written by this editor. tags.remove always removes the tag. The server configuration may restrict which tags can be added.'

function editing(ctx: ToolContext) {
  return {editor: ctx.editor, overwrite: ctx.overwrite}
}

function tags_being_added(tags: z.output<typeof TagChanges> | undefined) {
  return [...tags?.add ?? [], ...tags?.replace ?? []]
}


export const TOOLS: Record<ToolName, ToolDefinition> = {
  search_media: define_tool({
    description: `Search media (images, videos, audio, and media series) in the forager database. Media inside a series is excluded, use search_series to find it. ${PAGINATION_DESCRIPTION}`,
    read_only: true,
    input: z.object({
      query: MediaQuery.optional(),
      media_reference_id: z.number().int().optional().describe('Fetch a single media reference by id'),
      sort_by: MediaSortBy.default('source_created_at'),
      order: Order.default('desc'),
      thumbnail_limit: ThumbnailLimit,
      ...Pagination,
    }).strict(),
    handler: (ctx, args) => {
      const result = ctx.forager.media.search({
        query: {...core_media_query(args.query), media_reference_id: args.media_reference_id},
        sort_by: args.sort_by,
        order: args.order,
        thumbnail_limit: args.thumbnail_limit,
        limit: args.limit,
        cursor: decode_cursor(args.cursor),
      })
      return format_page(result, format_media)
    },
  }),

  search_series: define_tool({
    description: `Search media series. Without series_id, lists the series in the database. With series_id, lists the media inside that series. ${PAGINATION_DESCRIPTION}`,
    read_only: true,
    input: z.object({
      series_id: z.number().int().optional().describe('The media_reference_id of a series. When supplied, search the media inside the series'),
      query: MediaQuery.optional().describe('Filters. When listing series (no series_id) only tags, stars, stars_equality and unread apply'),
      sort_by: z.enum(['series_index', ...MediaSortBy.options]).optional().describe('Defaults to "series_index" when series_id is supplied, otherwise "source_created_at". "series_index" requires series_id'),
      order: Order.optional().describe('Defaults to "asc" when series_id is supplied, otherwise "desc"'),
      thumbnail_limit: ThumbnailLimit,
      ...Pagination,
    }).strict(),
    handler: (ctx, args) => {
      const cursor = decode_cursor(args.cursor)
      if (args.series_id === undefined) {
        if (args.sort_by === 'series_index') {
          throw new errors.BadInputError(`sort_by "series_index" requires a series_id`)
        }
        const result = ctx.forager.media.search({
          query: {...core_media_query(args.query), series: true},
          sort_by: args.sort_by,
          order: args.order,
          thumbnail_limit: args.thumbnail_limit,
          limit: args.limit,
          cursor,
        })
        return format_page(result, format_media)
      }
      const result = ctx.forager.series.search({
        query: {...core_media_query(args.query), series_id: args.series_id},
        sort_by: args.sort_by,
        order: args.order,
        thumbnail_limit: args.thumbnail_limit,
        limit: args.limit,
        cursor,
      })
      return format_page(result, format_media)
    },
  }),

  search_groups: define_tool({
    description: `Group media by the tags in a tag group, returning each tag with a count of matching media (e.g. grouping by "artist" returns "artist:alice" with 12 media). ${PAGINATION_DESCRIPTION}`,
    read_only: true,
    input: z.object({
      tag_group: z.string().describe('The tag group to group by (the "group" in "group:name")'),
      query: MediaQuery.optional(),
      sort_by: z.enum(['count', ...MediaSortBy.options]).default('count'),
      order: Order.default('desc'),
      grouped_media_limit: z.number().int().min(0).max(20).default(0).describe('Number of media to include under each group'),
      thumbnail_limit: ThumbnailLimit,
      ...Pagination,
    }).strict(),
    handler: (ctx, args) => {
      const result = ctx.forager.media.group({
        group_by: {tag_group: args.tag_group},
        query: core_media_query(args.query),
        sort_by: args.sort_by,
        order: args.order,
        grouped_media: {limit: args.grouped_media_limit || undefined},
        thumbnail_limit: args.thumbnail_limit,
        limit: args.limit,
        cursor: decode_cursor(args.cursor),
      })
      return format_page(result, grouped => format_group(args.tag_group, grouped))
    },
  }),

  search_tags: define_tool({
    description: `Search tags in the forager database. ${PAGINATION_DESCRIPTION}`,
    read_only: true,
    input: z.object({
      match: z.string().optional().describe('Match tags by "group:name" shorthand. Names match by prefix unless they contain a "*" wildcard (e.g. "genre:dr" or "genre:*ama")'),
      query: MediaQuery.optional().describe('Only return tags on media matching this query'),
      include_unreferenced_tags: z.boolean().default(false).describe('Include tags that are not attached to any media'),
      sort_by: z.enum(['media_reference_count', 'unread_media_reference_count', 'created_at', 'updated_at']).default('media_reference_count'),
      order: Order.default('desc'),
      ...Pagination,
    }).strict(),
    handler: (ctx, args) => {
      const result = ctx.forager.tag.search({
        query: args.match === undefined ? undefined : {tag_match: args.match},
        contextual_query: args.query ? core_media_query(args.query) : undefined,
        include_unreferenced_tags: args.include_unreferenced_tags,
        sort_by: args.sort_by,
        order: args.order,
        limit: args.limit,
        cursor: decode_cursor(args.cursor),
      })
      return format_page(result, format_tag)
    },
  }),

  create_media: define_tool({
    description: `Add a media file on disk to the forager database. Fails if the file already exists in the database, use upsert_media to create or update. ${WRITE_DESCRIPTION}`,
    read_only: false,
    input: z.object({
      filepath: AbsoluteFilepath,
      media_info: MediaInfo.optional(),
      tags: TagShorthand.array().optional(),
    }).strict(),
    handler: async (ctx, args) => {
      ctx.tag_policy.enforce(args.tags ?? [])
      const result = await ctx.forager.media.create(args.filepath, args.media_info, args.tags, {editor: ctx.editor})
      return format_media(result)
    },
  }),

  update_media: define_tool({
    description: `Update the media info and tags of existing media. ${WRITE_DESCRIPTION}`,
    read_only: false,
    input: z.object({
      media_reference_id: z.number().int(),
      media_info: MediaInfo.optional(),
      tags: TagChanges.optional(),
    }).strict(),
    handler: (ctx, args) => {
      ctx.tag_policy.enforce(tags_being_added(args.tags))
      const result = ctx.forager.media.update(args.media_reference_id, args.media_info, args.tags, editing(ctx))
      return format_media(result)
    },
  }),

  upsert_media: define_tool({
    description: `Add a media file on disk to the forager database, or update it if it already exists. tags.remove only applies when the media already exists. ${WRITE_DESCRIPTION}`,
    read_only: false,
    input: z.object({
      filepath: AbsoluteFilepath,
      media_info: MediaInfo.optional(),
      tags: TagChanges.optional(),
    }).strict(),
    handler: async (ctx, args) => {
      ctx.tag_policy.enforce(tags_being_added(args.tags))
      const result = await ctx.forager.media.upsert(args.filepath, args.media_info, args.tags, editing(ctx))
      return format_media(result)
    },
  }),
}
