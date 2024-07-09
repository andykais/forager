import z from 'zod'

export const SeriesItem = z.object({
  series_id: z.number(),
  media_reference_id: z.number(),
  series_index: z.number().optional(),
})

export const SeriesId = z.object({
  series_id: z.number(),
})
