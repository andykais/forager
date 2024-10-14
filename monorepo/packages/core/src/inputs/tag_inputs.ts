import z from 'zod'
import { errors } from "~/mod.ts";
import { PaginatedQuery } from "~/lib/inputs_base.ts";


const RESERVED = {
  groups: [
    'media',
    'sort',
    'order'
  ],
  names: [
    '',
  ]
}
const TagValue = z.string()
                  .regex(/[a-zA-Z0-9_ ]*/)
                  .transform(value => value.toLowerCase().replace(/ /g, '_'))
const TagMatch = z.string().regex(/[a-zA-Z0-9_*]*/)

export const TagShorthand = z.string().transform(tag_str => {
  const tag_split = tag_str.split(':')
  if (tag_split.length === 1) {
    return {
      name: tag_str,
      group: undefined,
    }
  }
  else if (tag_split.length === 2) {
    return {
      group: tag_split[0],
      name: tag_split[1],
    }
  } else {
    throw new errors.BadInputError(`Failed to parse tag shorthand "${tag_str}"`)
  }
})

export const TagObject = z.object({
  name: TagValue.superRefine((val, ctx) => {
    if (RESERVED.names.includes(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `'${val}' is a reserved tag name`
      })
    }
  }),
  group: TagValue.optional().default('').superRefine((val, ctx) => {
    if (RESERVED.groups.includes(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `'${val}' is a reserved tag group`
      })
    }
  }),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})


export const TagMatchObject = z.object({
  group: TagMatch.optional(),
  name: TagMatch.transform(v => {
    if (v.includes('*')) return v
    else if (v === '') return '*'
    // default match is "starts with"
    else return v + '*'
  }),
}).transform(v => {
  return {group: undefined, ...v}
})

export const Tag = TagObject.or(TagShorthand.pipe(TagObject))

export const TagList = z.array(Tag)

export const TagSearch  = PaginatedQuery.extend({
  query: z.object({
    tag_match: TagShorthand.pipe(TagMatchObject),
  }).strict()
    .optional()
    .transform(q => {
      return {...q}
    }),
  limit: z.number().optional().default(10),
  sort_by: z.enum(['created_at', 'updated_at', 'media_reference_count', 'unread_media_reference_count']).default('updated_at'),
  order: z.enum(['desc', 'asc']).default('desc'),
})
