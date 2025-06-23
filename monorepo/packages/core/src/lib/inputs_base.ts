import z from 'zod'


export type Literal = string | boolean | number | null
export type Json = Literal | { [key: string]: Json } | Json[];

export const LiteralInput = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const JsonInput: z.ZodSchema<Json> = z.lazy(() =>
  z.union([LiteralInput, z.array(JsonInput), z.record(JsonInput)])
)

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


export const Timestamp = z.number()


export const Duration = z.number()
