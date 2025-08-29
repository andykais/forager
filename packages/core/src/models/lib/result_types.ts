import { InferSchemaTypes } from '@torm/sqlite'
import * as models from '../mod.ts'

export type MediaReference = InferSchemaTypes<typeof models.MediaReference.result>
export type MediaReferenceTag = InferSchemaTypes<typeof models.MediaReferenceTag.result>
export type MediaSeriesItem = InferSchemaTypes<typeof models.MediaSeriesItem.result>
export type MediaFile = InferSchemaTypes<typeof models.MediaFile.result>
export type MediaThumbnail = InferSchemaTypes<typeof models.MediaThumbnail.result>
export type TagGroup = InferSchemaTypes<typeof models.TagGroup.result>
export type Tag = InferSchemaTypes<typeof models.Tag.result> & {group: TagGroup['name']; color: TagGroup['color']}
export type MediaKeypoint = InferSchemaTypes<typeof models.MediaKeypoint.result>
export type View = InferSchemaTypes<typeof models.View.result>
export type EditLog = InferSchemaTypes<typeof models.EditLog.result>

export type PaginatedResult<T> = {
  cursor: Record<string, string | number | null> | undefined
  total: number
  results: T[]
}

