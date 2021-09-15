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
  group: z.string().optional().transform(t => typeof t === 'string' ? sanitize_name(t) : null),
  filter: z.array(TagInput).optional().transform(v => v ?? []),
  limit: z.number().optional().default(10),
})
export type TagSearch = z.input<typeof TagSearchInput>

export const TagListInput = z.array(TagInput)
export type TagList = z.input<typeof TagListInput>
