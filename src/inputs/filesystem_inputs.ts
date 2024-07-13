import z from 'zod'
import { type Json, JsonInput, StringDateTime, PaginatedQuery } from '~/lib/inputs_base.ts'

export const FileSystemDiscover = z.object({
  path: z.string(),
  extensions: z.string()
               .refine(ext => !ext.startsWith('.'), 'Extensions must not start with "."')
               .array()
               .optional()
})
