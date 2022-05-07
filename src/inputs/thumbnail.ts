import { z } from 'zod'


export const ThumbnailQueryInput = z.union([
  z.object({ media_reference_id: z.number(), thumbnail_index: z.number() }).strict(),
  z.object({ media_file_id: z.number(), thumbnail_index: z.number() }).strict(),
  z.object({ thumbnail_id: z.number() }).strict(),
])
export type ThumbnailQuery = z.input<typeof ThumbnailQueryInput>
