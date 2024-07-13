import z from 'zod'
import { type Json, JsonInput, StringDateTime, PaginatedQuery } from '~/lib/inputs_base.ts'
import { Tag } from './tag_inputs.ts'


export const MediaInfo = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  metadata: JsonInput.optional(),
  source_url: z.string().optional(),
  source_created_at: z.union([z.date(), StringDateTime]).optional() as any, // I dont know how to fix this currently. Zod is making the output type the same as the input, though thats not what we get
  stars: z.number().optional(),
  view_count: z.number().optional(),
})


export const PaginatedSearch = PaginatedQuery.extend({
  query: z.object({
    series_id: z.number().optional(),
    filesystem: z.boolean().optional(),
    directory: z.string().optional(),
    media_reference_id: z.number().optional(),
    tags: z.array(Tag).optional(),
    stars: z.number().gte(0).lte(5).optional(),
    stars_equality: z.enum(['gte', 'eq']).default(('gte')),
    unread: z.boolean().default(false),
  }).strict()
    .refine(q => !(q.filesystem === false && q.directory), 'query.directory cannot be used with query.filesystem: false')
    .refine(q => !(q.series_id && q.directory), 'query.series_id and query.directory cannot be used in conjunction')
    .optional()
    .transform(q => {
      if (q?.directory) q.filesystem = true
      return {unread: false, ...q}
    }),
  sort_by: z.enum(['created_at', 'updated_at', 'source_created_at', 'view_count']).default('source_created_at'),
  order: z.enum(['desc', 'asc']).default('desc'),
}).strict()


export const MediaReferenceUpdate = MediaInfo
