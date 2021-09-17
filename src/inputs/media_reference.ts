import { z } from 'zod'
import { TagInput } from './'
import { parseISO } from 'date-fns'
import type { MediaInfo } from '../actions/media'
import type { Json } from '../util/types'

const StringDateTime = z.string().refine(parseISO).transform(parseISO)

export const PaginatedQueryInput = z.object({
  limit: z.number().default(100),
  cursor: z.tuple([
    z.union([z.number(), z.string(), z.null()]),
    z.number()
  ]).optional().nullable().transform(v => v ?? null)
}).strict()
export type PaginatedQuery = z.input<typeof PaginatedQueryInput>

export const PaginatedSearchInput = PaginatedQueryInput.extend({
  query: z.object({
    tag_ids: z.array(z.number()).optional(),
    tags: z.array(TagInput).optional(),
    stars: z.number().gte(0).lte(5).optional(),
    unread: z.boolean().default(false),
    sort_by: z.enum(['created_at', 'updated_at', 'source_created_at', 'view_count']).default('created_at'),
    order: z.enum(['desc', 'asc']).default('desc'),
  }).strict()
}).strict()
export type PaginatedSearch = z.input<typeof PaginatedSearchInput>
type O  =  z.infer<typeof PaginatedSearchInput>


const LiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const JsonSchema: z.ZodSchema<Json> = z.lazy(() =>
  z.union([LiteralSchema, z.array(JsonSchema), z.record(JsonSchema)])
);
export const MediaReferenceUpdateInput: z.ZodSchema<MediaInfo> = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  metadata: JsonSchema.optional(),
  source_url: z.string().optional(),
  source_created_at: z.union([z.date(), StringDateTime]).optional() as any, // I dont know how to fix this currently. Zod is making the output type the same as the input, though thats not what we get
  stars: z.number().optional(),
  view_count: z.number().optional(),
})
export type MediaReferenceUpdate = z.input<typeof MediaReferenceUpdateInput>
