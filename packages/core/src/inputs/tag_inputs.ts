import z from 'zod'
import { errors } from "~/mod.ts";
import { JsonDictionary } from "~/lib/inputs_base.ts";


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
        code: 'custom',
        message: `'${val}' is a reserved tag name`,
        input: val,
      })
    }
  }),
  group: TagValue.optional().default('').superRefine((val, ctx) => {
    if (RESERVED.groups.includes(val)) {
      ctx.addIssue({
        code: 'custom',
        message: `'${val}' is a reserved tag group`,
        input: val,
      })
    }
  }),
  description: z.string().optional(),
  metadata: JsonDictionary.optional(),
}).transform(tag => {

  const slug = tag_slug_format(tag)
  return {...tag, slug}
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

export function tag_slug_format(tag: {group?: string; name: string}) {
  let slug = tag.name
  if (tag.group) {
    slug = tag.group + ':' + tag.name
  }
  return slug
}

export const Tag = TagObject.or(TagShorthand.pipe(TagObject))

export const TagList = z.array(Tag)
