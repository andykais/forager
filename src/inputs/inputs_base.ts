import z from 'zod'


export type Literal = string | boolean | number | null
export type Json = Literal | { [key: string]: Json } | Json[];

export const LiteralInput = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const JsonInput: z.ZodSchema<Json> = z.lazy(() =>
  z.union([LiteralInput, z.array(JsonInput), z.record(JsonInput)])
)

export const PaginatedQuery = z.object({
  limit: z.number().default(100),
  cursor: z.tuple([
    z.union([z.number(), z.string(), z.null()]),
    z.number()
  ]).optional().nullable().transform(v => v ?? null)
}).strict()



export const StringDateTime = z.string().transform(date_str => Temporal.PlainDate.from(date_str))