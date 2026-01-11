import z from 'zod'
import { PaginatedQuery } from '~/lib/inputs_base.ts'
import { Tag } from './tag_inputs.ts'
import {MediaInfo} from './media_reference_inputs.ts'

const Duration = z.object({
  seconds: z.number().optional(),
  minutes: z.number().optional(),
  hours: z.number().optional(),
}).strict().transform(input => {
  // Only return undefined if no fields were provided
  if (input.seconds === undefined && input.minutes === undefined && input.hours === undefined) {
    return undefined
  }

  const total_seconds = (input.seconds ?? 0) + (input.minutes ?? 0) * 60 + (input.hours ?? 0) * 3600
  return {
    hours: total_seconds / 3600,
    minutes: total_seconds / 60,
    seconds: total_seconds,
  }
})


export const SeriesItem = z.object({
  series_id: z.number(),
  media_reference_id: z.number(),
  series_index: z.number().optional(),
})

export const SeriesGet = z.object({
  series_id: z.number().optional(),
  series_name: z.string().optional(),
})

export const SeriesSearchQuery = z.object({
  series_id: z.number(),
  animated: z.boolean().optional(),
  filepath: z.string().optional(),
  tags: z.array(Tag).optional(),
  keypoint: Tag.optional(),
  stars: z.number().gte(0).lte(5).optional(),
  stars_equality: z.enum(['gte', 'eq']).default('gte'),
  duration: z.object({
    min: Duration.optional(),
    max: Duration.optional(),
  }).strict().optional(),
  unread: z.boolean().optional(),
}).strict()

export const SeriesSearch = PaginatedQuery.extend({
  query: SeriesSearchQuery,
  thumbnail_limit: z.number().default(1),
  sort_by: z.enum(['series_index', 'created_at', 'updated_at', 'source_created_at', 'view_count', 'last_viewed_at', 'duration']).default('series_index'),
  order: z.enum(['desc', 'asc']).default('asc'),
}).strict()

export const MediaSeriesInfo = MediaInfo.extend({
  media_series_name: z.string().optional(),
})

export const MediaSeriesBulk = z.object({
  series: MediaSeriesInfo,
  series_index: z.number().optional()
}).array()
