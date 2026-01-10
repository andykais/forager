import z from 'zod'
import { JsonDictionary, PaginatedQuery } from '~/lib/inputs_base.ts'
import { Tag } from './tag_inputs.ts'


export const Filepath = z.string()


export const MediaReferenceId = z.number()


export const MediaReferenceGet = z.object({
  media_reference_id: MediaReferenceId.optional(),
  filepath: Filepath.optional(),
})


export const MediaInfo = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  metadata: JsonDictionary.optional(),
  source_url: z.string().optional(),
  source_created_at: z.coerce.date().optional(),
  stars: z.number().optional(),
  view_count: z.number().optional(),
})


const Duration = z.object({
  seconds: z.number().optional(),
  minutes: z.number().optional(),
  hours: z.number().optional(),
}).strict().transform(input => {
  const total_seconds = (input.seconds ?? 0) + (input.minutes ?? 0) * 60 + (input.hours ?? 0) * 3600
  if (total_seconds === 0) return undefined
  return {
    hours: total_seconds / 3600,
    minutes: total_seconds / 60,
    seconds: total_seconds,
  }
})

export const MediaReferenceQuery = z.object({
  series_id: z.number().optional(),
  series: z.boolean().optional(),
  animated: z.boolean().optional(),
  /** filepath can be an exact path or a glob */
  filepath: z.string().optional(),
  media_reference_id: z.number().optional(),
  tags: z.array(Tag).optional(),
  keypoint: Tag.optional(),
  stars: z.number().gte(0).lte(5).optional(),
  stars_equality: z.enum(['gte', 'eq']).default(('gte')),
  duration: z.object({
    min: Duration.optional(),
    max: Duration.optional(),
  }).strict().optional(),
  unread: z.boolean().optional(),
}).strict()
  .optional()

export const PaginatedSearch = PaginatedQuery.extend({
  query: MediaReferenceQuery.prefault({}),
  thumbnail_limit: z.number().default(1),
  sort_by: z.enum(['created_at', 'updated_at', 'source_created_at', 'view_count', 'last_viewed_at']).default('source_created_at'),
  order: z.enum(['desc', 'asc']).default('desc'),
}).strict()


export const PaginatedSearchGroupBy = PaginatedSearch.extend({
  group_by: z.object({
    tag_group: z.string(),
  }),
  grouped_media: z.object({
    limit: z.number().optional(),
    sort_by: z.enum(['created_at', 'updated_at', 'source_created_at', 'view_count']).default('source_created_at'),
  }).prefault({}),
  sort_by: z.enum(['count', 'created_at', 'updated_at', 'source_created_at', 'view_count', 'last_viewed_at']).default('count'),
})


export const MediaReferenceUpdate = MediaInfo

export const MediaReferenceUpdateTagsAddAndRemove = z.object({
  add: Tag.array().optional().transform(taglist => taglist ?? []),
  remove: Tag.array().optional().transform(taglist => taglist ?? []),
  replace: Tag.array().optional(),
})

export const MediaReferenceUpdateTags = z.union([Tag.array(), MediaReferenceUpdateTagsAddAndRemove])
  .optional()
  .default({replace: undefined, add: [], remove: []})
  .transform(instructions => {
    if (Array.isArray(instructions)) return {replace: instructions, add: [], remove: []} as z.infer<typeof MediaReferenceUpdateTagsAddAndRemove>
    else return instructions as z.infer<typeof MediaReferenceUpdateTagsAddAndRemove>
  })
