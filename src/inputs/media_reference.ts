import z from 'zod'
import { type Json, JsonInput, StringDateTime } from './inputs_base.ts'
import { Tag } from './tag.ts'


export const MediaInfo = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  metadata: JsonInput.optional(),
  source_url: z.string().optional(),
  source_created_at: z.union([z.date(), StringDateTime]).optional() as any, // I dont know how to fix this currently. Zod is making the output type the same as the input, though thats not what we get
  stars: z.number().optional(),
  view_count: z.number().optional(),
})


export const PaginatedQuery = z.object({
  limit: z.number().default(100),
  cursor: z.tuple([
    z.union([z.number(), z.string(), z.null()]),
    z.number()
  ]).optional().nullable().transform(v => v ?? null)
}).strict()


export const PaginatedSearch = PaginatedQuery.extend({
  query: z.object({
    tag_ids: z.array(z.number()).optional(),
    tags: z.array(Tag).optional(),
    stars: z.number().gte(0).lte(5).optional(),
    stars_equality: z.enum(['gte', 'eq']).default(('gte')),
    unread: z.boolean().default(false),
    sort_by: z.enum(['created_at', 'updated_at', 'source_created_at', 'view_count']).default('source_created_at'),
    order: z.enum(['desc', 'asc']).default('desc'),
  }).strict()
}).strict()


export const MediaReferenceUpdate = MediaInfo
