import { z } from 'zod'


export const MediaFileQueryInput = z.union([
  z.object({ media_reference_id: z.number() }).strict(),
  z.object({ media_file_id: z.number() }).strict(),
])
export type MediaFileQuery = z.input<typeof MediaFileQueryInput>
