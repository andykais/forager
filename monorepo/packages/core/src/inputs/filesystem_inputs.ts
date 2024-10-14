import z from 'zod'
import { Tag } from './tag_inputs.ts'
import { MediaInfo } from './media_reference_inputs.ts'

export const FileSystemDiscover = z.object({
  path: z.string(),
  extensions: z.string()
               .refine(ext => !ext.startsWith('.'), 'Extensions must not start with "."')
               .array()
               .optional(),

  set: z.object({
    media_info: MediaInfo.optional(),
    tags: Tag.array().optional(),
  }).optional(),
})
