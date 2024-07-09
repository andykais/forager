import z from 'zod'


function sanitize_name(name: string) {
  return name.toLowerCase().replace(/ /g, '_')
}

export const TagShorthand = z.string().transform(tag_str => {
  const tag_split = tag_str.split(':')
  if (tag_split.length === 1) {
    return {
      name: tag_str,
      group: '',
    }
  }
  else {
    throw new Error('unimplemented')
  }
})

export const TagObject = z.object({
  name: z.string().transform(sanitize_name),
  group: z.string().optional().default('').transform(sanitize_name),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

export const Tag = TagObject.or(TagShorthand.pipe(TagObject))

export const TagSearch = z.object({
  name: z.string().transform(sanitize_name),
  group: z.string().optional().nullable().transform(t => typeof t === 'string' ? sanitize_name(t) : null),
  filter: z.array(Tag).optional().transform(v => v ?? []),
  limit: z.number().optional().default(10),
  sort_by: z.enum(['created_at', 'updated_at', 'media_reference_count', 'unread_media_reference_count']).default('updated_at'),
  order: z.enum(['desc', 'asc']).default('desc'),
})
export const TagList = z.array(Tag)
