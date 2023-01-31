import { z, expect_type } from '../deps.ts'
import { TagInput } from './mod.ts'
import { type Json } from '../context.ts'


const LiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const JsonSchema: z.ZodSchema<Json> = z.lazy(() =>
  z.union([LiteralSchema, z.array(JsonSchema), z.record(JsonSchema)])
);


export interface MediaInfo {
  title?: string
  description?: string
  metadata?: Json
  source_url?: string
  source_created_at?: Date
  stars?: number
  view_count?: number
}


const StringDateTime = z.string()
  .refine(date_str => new Date(date_str))
  .transform(date_str => new Date(date_str))


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
    stars_equality: z.enum(['gte', 'eq']).default(('gte')),
    unread: z.boolean().default(false),
    sort_by: z.enum(['created_at', 'updated_at', 'source_created_at', 'view_count']).default('source_created_at'),
    order: z.enum(['desc', 'asc']).default('desc'),
  }).strict().default({})
}).strict()
export type PaginatedSearch = z.input<typeof PaginatedSearchInput>


export const MediaReferenceUpdateInput: z.ZodSchema<MediaInfo> = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  metadata: JsonSchema.optional(),
  source_url: z.string().optional(),
  source_created_at: z.union([z.date(), StringDateTime]).optional() as any, // I dont know how to fix this currently. Zod is making the output type the same as the input, though thats not what we get
  stars: z.number().optional(),
  view_count: z.number().optional(),
})
// typescript compile-time coupling check
expect_type<MediaInfo>({} as z.input<typeof MediaReferenceUpdateInput>)
export type MediaReferenceUpdate = z.input<typeof MediaReferenceUpdateInput>
