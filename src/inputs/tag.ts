import { z } from 'zod'

function sanitize_name(name: string) {
  return name.toLowerCase().replace(/ /g, '_')
}

export const TagInput = z.object({
  group: z.string().optional().default('').transform(sanitize_name),
  name: z.string().transform(sanitize_name)
})
export type Tag = z.input<typeof TagInput>

export const TagSearchInput = TagInput.extend({
  group: z.string().optional().transform(t => typeof t === 'string' ? sanitize_name(t) : null),
})
export type TagSearch = z.input<typeof TagSearchInput>

export const TagListInput = z.array(TagInput)
export type TagList = z.input<typeof TagListInput>
