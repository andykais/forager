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
}).strict()
export type PaginatedQuery = z.input<typeof PaginatedQueryInput>

export const PaginatedSearchInput = PaginatedQueryInput.extend({
  query: z.object({
    tag_ids: z.array(z.number()).optional(),
    tags: z.array(TagInput).optional(),
    stars: z.number().optional(),
  }).strict()
}).strict()
// export const TagSearchInput = PaginatedQueryInput.extend({
//   tags: z.array(TagInput),
// })

export type PaginatedSearch = z.input<typeof PaginatedSearchInput>
