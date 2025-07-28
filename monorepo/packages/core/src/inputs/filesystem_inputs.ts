import z from 'zod'
import { PaginatedQuery } from '~/lib/inputs_base.ts'

export const FileSystemDiscover = z.object({
  path: z.string(),
  extensions: z.string()
               .refine(ext => !ext.startsWith('.'), 'Extensions must not start with "."')
               .array()
               .optional(),
})

export const FileSystemQuery = z.object({
  path: z.string().optional(),
  extensions: z.string()
               .refine(ext => !ext.startsWith('.'), 'Extensions must not start with "."')
               .array()
               .optional(),
}).strict()

export const FileSystemSearch = PaginatedQuery.extend({
  query: FileSystemQuery.optional()
})
