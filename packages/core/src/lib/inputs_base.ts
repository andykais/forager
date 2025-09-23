import z from 'zod'


export type Literal = string | boolean | number | null
export type Json = Literal | { [key: string]: Json } | Json[];

export const LiteralInput = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const JsonInput = z.json()
export const JsonDictionary = z.record(z.string(), z.json())

export const PaginatedQuery = z.object({
  limit: z.number().default(100),
  cursor: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
}).strict()


export const Editing = z.object({
  editor: z.string().optional(),
}).strict()


export const CreateEditing = Editing.extend({
}).optional()


export const UpdateEditing = Editing.extend({
  overwrite: z.boolean().default(true)
}).optional()
.refine(editing => {
  if (editing?.overwrite === false && editing.editor === undefined) {
    return false
  } else {
    return true
  }
}, 'Overwrite behavor cannot be specified without supplying an editor')


export const Timestamp = z.number()


export const Duration = z.number()
