import { z } from 'zod'

function sanitize_name(name: string) {
  return name.toLowerCase().replace(/ /g, '_')
}

const TagInput = z.object({
  group: z.string().optional().default('').transform(sanitize_name),
  name: z.string().transform(sanitize_name)
})
type Tag = z.input<typeof TagInput>

export { TagInput }
export type { Tag }
