import * as z from 'zod'
import * as parsers from './inputs_parsers.ts'


export type MediaReferenceId = z.input<typeof parsers.MediaReferenceId>
export type Filepath = z.infer<typeof parsers.Filepath>
export type MediaInfo = z.infer<typeof parsers.MediaInfo>
export type PaginatedSearch = z.input<typeof parsers.PaginatedSearch>
export type MediaReferenceUpdate = z.input<typeof parsers.MediaReferenceUpdate>
export type MediaReferenceGet = z.input<typeof parsers.MediaReferenceGet>

export type Tag = z.input<typeof parsers.Tag>
export type TagSearch = z.input<typeof parsers.TagSearch>
export type TagList = z.input<typeof parsers.TagList>

export type SeriesItem = z.input<typeof parsers.SeriesItem>
export type SeriesId = z.input<typeof parsers.SeriesId>

export type FileSystemDiscover = z.input<typeof parsers.FileSystemDiscover>

export type KeypointCreate = z.input<typeof parsers.KeypointCreate>

export type ViewCreate = z.input<typeof parsers.ViewCreate>
export type ViewUpdate = z.input<typeof parsers.ViewUpdate>

/* TODO neat idea here, but this doesnt export a namespace so typescript cannot access these as tersley as explicit exports
type ParsersToInputType<T extends Record<string, z.ZodType<any, any, any>>> = {
  [K in keyof T]: z.infer<T[K]>
}
export const inputs: ParsersToInputType<typeof parsers> = {} as any
export type Inputs = ParsersToInputType<typeof parsers>

// we can only access this as a type
type X = inputs['MediaInfo']
*/
