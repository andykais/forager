import z from 'zod'


export type Literal = string | boolean | number | null
export type Json = Literal | { [key: string]: Json } | Json[];

export const LiteralInput = z.union([z.string(), z.number(), z.boolean(), z.null()]);
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


export const DurationSeconds = z.number()
export const DurationSpec = z.object({
  seconds: DurationSeconds,
  minutes: z.number(),
  hours: z.number(),
  days: z.number(),
  years: z.number(),
}).transform(spec => {
  let duration_seconds = 0
  duration_seconds += spec.seconds ?? 0
  duration_seconds += spec.minutes ? spec.minutes * 60 : 0
  duration_seconds += spec.hours ? spec.hours * 60 * 60 : 0
  duration_seconds += spec.days ? spec.hours * 60 * 60 * 24 : 0
  duration_seconds += spec.years ? spec.years * 60 * 60 * 24 * 365 : 0

  return duration_seconds
})

export const Duration = z.union([DurationSeconds, DurationSpec])
