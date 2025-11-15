import * as z from 'zod'
import * as parsers from './inputs_parsers.ts'


export type MediaInfo = z.infer<typeof parsers.MediaInfo>
export type SeriesGet = z.infer<typeof parsers.SeriesGet>
export type MediaReferenceUpdateTags = z.infer<typeof parsers.MediaReferenceUpdateTags>
export type ForagerConfig = z.infer<typeof parsers.ForagerConfig>
export type FileSystemDiscover = z.infer<typeof parsers.FileSystemDiscover>
export type MediaReferenceSearchSortBy = z.infer<typeof parsers.PaginatedSearch>['sort_by']
export type MediaReferenceGroupSearchSortBy = z.infer<typeof parsers.PaginatedSearchGroupBy>['sort_by']
