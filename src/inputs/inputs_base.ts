import z from 'zod'


export type Literal = string | boolean | number | null
export type Json = Literal | { [key: string]: Json } | Json[];

export const LiteralInput = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const JsonInput: z.ZodSchema<Json> = z.lazy(() =>
  z.union([LiteralInput, z.array(JsonInput), z.record(JsonInput)])
)

export const StringDateTime = z.string().transform(date_str => Temporal.PlainDate.from(date_str))