import { type Json } from '../context.ts'
import { z } from '../deps.ts'

const LiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const JsonSchema: z.ZodSchema<Json> = z.lazy(() =>
  z.union([LiteralSchema, z.array(JsonSchema), z.record(JsonSchema)])
);

export * from './media_reference.ts'
export * from './tag.ts'
