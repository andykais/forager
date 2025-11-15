import z from 'zod'
import {MediaInfo} from './media_reference_inputs.ts'


export const SeriesItem = z.object({
  series_id: z.number(),
  media_reference_id: z.number(),
  series_index: z.number().optional(),
})

export const SeriesGet = z.object({
  series_id: z.number().optional(),
  series_name: z.string().optional(),
})

export const MediaSeriesInfo = MediaInfo.extend({
  media_series_name: z.string().optional(),
})

export const MediaSeriesBulk = z.object({
  series: MediaSeriesInfo,
  series_index: z.number().optional()
}).array()
