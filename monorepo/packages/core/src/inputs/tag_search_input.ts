import z from 'zod'
import { PaginatedQuery } from '~/lib/inputs_base.ts'
import { TagShorthand, TagMatchObject } from '~/inputs/tag_inputs.ts'
import { MediaReferenceQuery } from '~/inputs/media_reference_inputs.ts'


export const TagSearch  = PaginatedQuery.extend({
  query: z.object({
    tag_match: TagShorthand.pipe(TagMatchObject),
  }).strict()
    .optional()
    .transform(q => {
      return {...q}
    }),
  contextual_query: MediaReferenceQuery,
  limit: z.number().optional().default(10),
  sort_by: z.enum(['created_at', 'updated_at', 'media_reference_count', 'unread_media_reference_count']).default('media_reference_count'),
  order: z.enum(['desc', 'asc']).default('desc'),
})
