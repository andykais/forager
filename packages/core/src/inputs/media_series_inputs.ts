import z from 'zod'
import { PaginatedQuery } from '~/lib/inputs_base.ts'
import { Tag } from './tag_inputs.ts'

export const SeriesItem = z.object({
  series_id: z.number(),
  media_reference_id: z.number(),
  series_index: z.number().optional(),
})

export const SeriesId = z.object({
  series_id: z.number(),
})

export const SeriesSearchQuery = z.object({
  series_id: z.number(),
  animated: z.boolean().optional(),
  filepath: z.string().optional(),
  tags: z.array(Tag).optional(),
  keypoint: Tag.optional(),
  stars: z.number().gte(0).lte(5).optional(),
  stars_equality: z.enum(['gte', 'eq']).default('gte'),
  unread: z.boolean().optional(),
}).strict()

export const SeriesSearch = PaginatedQuery.extend({
  query: SeriesSearchQuery,
  thumbnail_limit: z.number().default(1),
  sort_by: z.enum(['series_index', 'created_at', 'updated_at', 'source_created_at', 'view_count', 'last_viewed_at']).default('series_index'),
  order: z.enum(['desc', 'asc']).default('asc'),
}).strict()
