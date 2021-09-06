import { z } from 'zod'
import { TagInput } from './'
import { parseISO } from 'date-fns'

const StringDateTime = z.string().refine(parseISO).transform(parseISO)

export const PaginatedQueryInput = z.object({
  limit: z.number().default(100),
  cursor: z
    .union([StringDateTime, z.date()])
    .optional()
    .transform((d) => d ?? new Date()),
})
export type PaginatedQuery = z.input<typeof PaginatedQueryInput>

export const TagSearchInput = PaginatedQueryInput.extend({
  tags: z.array(TagInput),
})
export type TagSearch = z.input<typeof TagSearchInput>
