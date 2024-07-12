import { InferSchemaTypes } from 'torm'
import * as models from '../mod.ts'

export type MediaReference = InferSchemaTypes<typeof models.MediaReference.result>
export type MediaReferenceTag = InferSchemaTypes<typeof models.MediaReferenceTag.result>
export type MediaSeriesItem = InferSchemaTypes<typeof models.MediaSeriesItem.result>
export type MediaFile = InferSchemaTypes<typeof models.MediaFile.result>
export type MediaThumbnail = InferSchemaTypes<typeof models.MediaThumbnail.result>
export type Tag = InferSchemaTypes<typeof models.Tag.result>
export type TagGroup = InferSchemaTypes<typeof models.TagGroup.result>

export type PaginatedResult<T> = {
  cursor: number | undefined
  total: number
  result: T[]
}

