import { Model, field } from 'torm'
import { MediaReference } from './media_reference.ts'

class MediaFile extends Model('media_file', {
  id:                 field.number(),
  media_reference_id: field.number(),  // TODO support MediaReference.schema.id here
  filename:           field.string(),
  file_size_bytes:    field.number(),
  checksum:           field.string(),
  media_type:         field.string(),  // TODO enum support
  codec:              field.string(),
  content_type:       field.string(),
  width:              field.number().optional(),
  height:             field.number().optional(),
  animated:           field.boolean().optional(),
  duration:           field.number(),
  framerate:          field.number(),
  updated_at:         field.datetime(),
  created_at:         field.datetime(),

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
