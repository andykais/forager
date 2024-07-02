import * as torm from 'torm'
import { ForagerTorm } from '../db/mod.ts'
import { MediaReference } from './media_reference.ts'

class MediaFile extends torm.Model('media_file', {
  id:       torm.field.number(),
  media_reference_id: torm.field.number(),  // TODO support MediaReference.schema.id here
  filename:           torm.field.string(),
  file_size_bytes:    torm.field.number(),
  checksum:           torm.field.string(),
  media_type:         torm.field.string(),  // TODO enum support
  codec:              torm.field.string(),
  content_type:       torm.field.string(),
  width:              torm.field.number().optional(),
  height:             torm.field.number().optional(),
  animated:           torm.field.boolean().optional(),
  duration:           torm.field.number(),
  framerate:          torm.field.number(),
  updated_at:         torm.field.datetime(),
  created_at:         torm.field.datetime(),

}) {
  find_by_checksum = this.query.one`
    SELECT ${MediaFile.result['*']} FROM media_file
    WHERE checksum = ${MediaFile.params.checksum}`

  create = this.query.one`INSERT INTO media_file (
    filename,
    file_size_bytes,
    checksum,
    media_type,
    content_type,
    codec,
    width,
    height,
    animated,
    duration,
    framerate,
    media_reference_id
  ) VALUES (${[
    MediaFile.params.filename,
    MediaFile.params.file_size_bytes,
    MediaFile.params.checksum,
    MediaFile.params.media_type,
    MediaFile.params.content_type,
    MediaFile.params.codec,
    MediaFile.params.width,
    MediaFile.params.height,
    MediaFile.params.animated,
    MediaFile.params.duration,
    MediaFile.params.framerate,
    MediaFile.params.media_reference_id,
  ]}) RETURNING ${MediaFile.result.id}`
}

export { MediaFile }
