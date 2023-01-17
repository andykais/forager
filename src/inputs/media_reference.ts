import { z, expect_type } from '../deps.ts'
import { JsonSchema } from './mod.ts'
import { type Json } from '../context.ts'


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
