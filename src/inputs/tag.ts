import { z } from 'zod'

function sanitize_name(name: string) {
  return name.toLowerCase().replace(/ /g, '_')
}

export const TagInput = z.object({
  name: z.string().transform(sanitize_name),
  group: z.string().optional().default('').transform(sanitize_name),
})
export type Tag = z.input<typeof TagInput>

export const TagSearchInput = z.object({
  name: z.string().transform(sanitize_name),
  group: z.string().optional().nullable().transform(t => typeof t === 'string' ? sanitize_name(t) : null),
  filter: z.array(TagInput).optional().transform(v => v ?? []),
  limit: z.number().optional().default(10),
  sort_by: z.enum(['created_at', 'updated_at', 'media_reference_count', 'unread_media_reference_count']).default('created_at'),
  order: z.enum(['desc', 'asc']).default('desc'),
})
export type TagSearch = z.input<typeof TagSearchInput>

export const TagListInput = z.array(TagInput)
export type TagList = z.input<typeof TagListInput>
