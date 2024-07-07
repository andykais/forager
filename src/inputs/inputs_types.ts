import * as z from 'zod'
import * as parsers from './inputs_parsers.ts'


export type MediaInfo = z.infer<typeof parsers.MediaInfo>
export type PaginatedSearch = z.input<typeof parsers.PaginatedSearch>
export type MediaReferenceUpdate = z.input<typeof parsers.MediaReferenceUpdate>

export type Tag = z.input<typeof parsers.Tag>
export type TagSearch = z.input<typeof parsers.TagSearch>
export type TagList = z.input<typeof parsers.TagList>

/* TODO neat idea here, but this doesnt export a namespace so typescript cannot access these as tersley as explicit exports
type ParsersToInputType<T extends Record<string, z.ZodType<any, any, any>>> = {
  [K in keyof T]: z.infer<T[K]>
}
export const inputs: ParsersToInputType<typeof parsers> = {} as any
export type Inputs = ParsersToInputType<typeof parsers>

// we can only access this as a type
type X = inputs['MediaInfo']
*/
