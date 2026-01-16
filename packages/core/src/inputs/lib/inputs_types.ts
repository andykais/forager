import * as z from 'zod'
import * as parsers from './inputs_parsers.ts'


export type MediaReferenceId = z.input<typeof parsers.MediaReferenceId>
export type Filepath = z.infer<typeof parsers.Filepath>
export type MediaInfo = z.infer<typeof parsers.MediaInfo>
export type MediaSeriesInfo = z.infer<typeof parsers.MediaSeriesInfo>
export type MediaSeriesBulk = z.infer<typeof parsers.MediaSeriesBulk>
export type PaginatedSearch = z.input<typeof parsers.PaginatedSearch>
export type PaginatedSearchGroupBy = z.input<typeof parsers.PaginatedSearchGroupBy>
export type MediaReferenceUpdate = z.input<typeof parsers.MediaReferenceUpdate>
export type MediaReferenceUpdateTags = z.input<typeof parsers.MediaReferenceUpdateTags>
export type MediaReferenceGet = z.input<typeof parsers.MediaReferenceGet>
export type MediaThumbnailGet = z.input<typeof parsers.MediaThumbnailGet>

export type Tag = z.input<typeof parsers.Tag>
export type TagSearch = z.input<typeof parsers.TagSearch>
export type TagList = z.input<typeof parsers.TagList>

export type SeriesItem = z.input<typeof parsers.SeriesItem>
export type SeriesGet = z.input<typeof parsers.SeriesGet>
export type SeriesSearch = z.input<typeof parsers.SeriesSearch>

export type FileSystemDiscover = z.input<typeof parsers.FileSystemDiscover>
export type FileSystemSearch = z.input<typeof parsers.FileSystemSearch>

export type IngestStart = z.input<typeof parsers.IngestStart>
export type IngestStop = z.input<typeof parsers.IngestStop>
export type IngestStatus = z.input<typeof parsers.IngestStatus>
export type IngestSearch = z.input<typeof parsers.IngestSearch>
export type IngestUpdate = z.input<typeof parsers.IngestUpdate>

export type KeypointCreate = z.input<typeof parsers.KeypointCreate>

export type ViewCreate = z.input<typeof parsers.ViewCreate>
export type ViewUpdate = z.input<typeof parsers.ViewUpdate>

export type ForagerConfig = z.input<typeof parsers.ForagerConfig>

/* TODO neat idea here, but this doesnt export a namespace so typescript cannot access these as tersley as explicit exports
type ParsersToInputType<T extends Record<string, z.ZodType<any, any, any>>> = {
  [K in keyof T]: z.infer<T[K]>
}
export const inputs: ParsersToInputType<typeof parsers> = {} as any
export type Inputs = ParsersToInputType<typeof parsers>

// we can only access this as a type
type X = inputs['MediaInfo']
*/
