import z from 'zod'
import { Tag } from '~/inputs/tag_inputs.ts'


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
  alias_tag: Tag,
  alias_for_tag: Tag,
})

export const TagAliasDelete = z.object({
  id: z.number().int(),
})

export const TagParentCreate = z.object({
  child_tag: Tag,
  parent_tag: Tag,
})

export const TagParentDelete = z.object({
  id: z.number().int(),
})
