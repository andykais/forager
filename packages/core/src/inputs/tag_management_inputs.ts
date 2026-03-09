import z from 'zod'


export const TagGet = z.object({
  slug: z.string(),
})

export const TagUpdate = z.object({
  slug: z.string(),
  name: z.string().optional(),
  group: z.string().optional(),
  description: z.string().optional(),
})

export const TagAliasCreate = z.object({
  source_tag_slug: z.string(),
  target_tag_slug: z.string(),
})

export const TagAliasDelete = z.object({
  id: z.number().int(),
})

export const TagParentCreate = z.object({
  source_tag_slug: z.string(),
  target_tag_slug: z.string(),
})

export const TagParentDelete = z.object({
  id: z.number().int(),
})
