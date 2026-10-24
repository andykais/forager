import z from 'zod'
import * as path from '@std/path'
import { type Forager, type inputs, parsers } from '@forager/core'
import type { ToolName } from './config.ts'
import type { TagPolicy } from './tag_policy.ts'
import { format_group, format_media, format_page, format_tag } from './format.ts'


export interface ToolContext {
  forager: Forager
  editor: string
  overwrite: boolean
  tag_policy: TagPolicy
}

/**
 * An mcp tool backed by a @forager/core action. Inputs reuse the core parsers so the tool schema always matches the action it calls.
 * Handlers receive the raw (unparsed) arguments, since core actions parse their own inputs.
 */
export interface ToolDefinition<Input extends z.ZodType = z.ZodType> {
  description: string
  read_only: boolean
  input: Input
  handler: (ctx: ToolContext, args: z.input<Input>) => unknown
}

function define_tool<Input extends z.ZodType>(tool: ToolDefinition<Input>): ToolDefinition {
  return tool as unknown as ToolDefinition
}


/** Core searches default to 100 results, which is a lot of context for an agent */
const DEFAULT_LIMIT = 25
const Limit = z.number().int().min(1).max(100).default(DEFAULT_LIMIT)

const PAGINATION_DESCRIPTION = 'Results are paginated. When the response includes a cursor, call again with the same arguments and that cursor to fetch the next page.'

const AbsoluteFilepath = parsers.Filepath.refine(filepath => path.isAbsolute(filepath), 'filepath must be an absolute path')

const MediaInfo = parsers.MediaInfo.omit({view_count: true}).strict()

/** core action signatures type media_info with the parsed output (source_created_at: Date), but they parse (and coerce) their input themselves */
function media_info(info: z.input<typeof MediaInfo> | undefined) {
  return info as inputs.MediaInfo | undefined
}

const WRITE_DESCRIPTION = 'Writes are recorded under this server\'s editor. Unless the server is configured to overwrite other editors, media info fields written by other editors are left untouched and tags.replace only replaces tags written by this editor. tags.remove always removes the tag. The server configuration may restrict which tags can be added.'

function editing(ctx: ToolContext) {
  return {editor: ctx.editor, overwrite: ctx.overwrite}
}

function tags_being_added(tags: inputs.MediaReferenceUpdateTags) {
  const parsed = parsers.MediaReferenceUpdateTags.parse(tags)
  return [...parsed.add, ...parsed.replace ?? []]
}


export const TOOLS: Record<ToolName, ToolDefinition> = {
  media_search: define_tool({
    description: `Search media (images, videos, audio, and media series). Media inside a series is excluded unless query.series_id is set, use query.series to only list series. ${PAGINATION_DESCRIPTION}`,
    read_only: true,
    input: parsers.PaginatedSearch.extend({limit: Limit}),
    handler: (ctx, args) => {
      const result = ctx.forager.media.search({...args, limit: args.limit ?? DEFAULT_LIMIT})
      return format_page(result, format_media)
    },
  }),

  media_group: define_tool({
    description: `Group media by the tags in a tag group, returning each tag with a count of matching media (e.g. grouping by "artist" returns "artist:alice" with 12 media). ${PAGINATION_DESCRIPTION}`,
    read_only: true,
    input: parsers.PaginatedSearchGroupBy.extend({limit: Limit}),
    handler: (ctx, args) => {
      const result = ctx.forager.media.group({...args, limit: args.limit ?? DEFAULT_LIMIT})
      return format_page(result, grouped => format_group(args.group_by.tag_group, grouped))
    },
  }),

  series_search: define_tool({
    description: `Search the media inside a series. Use media_search with query.series to find series. ${PAGINATION_DESCRIPTION}`,
    read_only: true,
    input: parsers.SeriesSearch.extend({limit: Limit}),
    handler: (ctx, args) => {
      const result = ctx.forager.series.search({...args, limit: args.limit ?? DEFAULT_LIMIT})
      return format_page(result, format_media)
    },
  }),

  tag_search: define_tool({
    description: `Search tags in the forager database. ${PAGINATION_DESCRIPTION}`,
    read_only: true,
    input: parsers.TagSearch.extend({limit: Limit}),
    handler: (ctx, args) => {
      const result = ctx.forager.tag.search({...args, limit: args.limit ?? DEFAULT_LIMIT})
      return format_page(result, format_tag)
    },
  }),

  media_create: define_tool({
    description: `Add a media file on disk to the forager database. Fails if the file already exists in the database, use media_upsert to create or update. ${WRITE_DESCRIPTION}`,
    read_only: false,
    input: z.object({
      filepath: AbsoluteFilepath,
      media_info: MediaInfo.optional(),
      tags: parsers.TagList.optional(),
    }).strict(),
    handler: async (ctx, args) => {
      ctx.tag_policy.enforce(parsers.TagList.parse(args.tags ?? []))
      const result = await ctx.forager.media.create(args.filepath, media_info(args.media_info), args.tags, {editor: ctx.editor})
      return format_media(result)
    },
  }),

  media_update: define_tool({
    description: `Update the media info and tags of existing media. ${WRITE_DESCRIPTION}`,
    read_only: false,
    input: z.object({
      media_reference_id: parsers.MediaReferenceId,
      media_info: MediaInfo.optional(),
      tags: parsers.MediaReferenceUpdateTags,
    }).strict(),
    handler: (ctx, args) => {
      ctx.tag_policy.enforce(tags_being_added(args.tags))
      const result = ctx.forager.media.update(args.media_reference_id, media_info(args.media_info), args.tags, editing(ctx))
      return format_media(result)
    },
  }),

  media_upsert: define_tool({
    description: `Add a media file on disk to the forager database, or update it if it already exists. tags.remove only applies when the media already exists. ${WRITE_DESCRIPTION}`,
    read_only: false,
    input: z.object({
      filepath: AbsoluteFilepath,
      media_info: MediaInfo.optional(),
      tags: parsers.MediaReferenceUpdateTags,
    }).strict(),
    handler: async (ctx, args) => {
      ctx.tag_policy.enforce(tags_being_added(args.tags))
      const result = await ctx.forager.media.upsert(args.filepath, media_info(args.media_info), args.tags, editing(ctx))
      return format_media(result)
    },
  }),
}


/** Convert a tool input to the json schema sent to mcp clients. Core inputs coerce dates, which are sent as ISO 8601 strings */
export function tool_json_schema(input: z.ZodType) {
  return z.toJSONSchema(input, {
    io: 'input',
    unrepresentable: 'any',
    override: ctx => {
      if (ctx.zodSchema._zod.def.type === 'date') {
        ctx.jsonSchema.type = 'string'
        ctx.jsonSchema.format = 'date-time'
      }
    },
  })
}
