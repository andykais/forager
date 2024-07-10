import { field, schema } from 'torm'
import { MediaReference } from './media_reference.ts'
import { Model, type SelectOneOptions } from './lib/base.ts'
import * as errors from '~/lib/errors.ts'

const SCHEMA = schema('media_file', {
  id:                 field.number(),
  media_reference_id: field.number(),  // TODO support MediaReference.schema.id here
  filepath:           field.string(),
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
})

interface SelectOneParams {
  media_reference_id?: number
  checksum?: string
}

class MediaFile extends Model {
  static params = SCHEMA.params
  static result = SCHEMA.result

  #select_by_media_reference_id = this.query`
    SELECT ${MediaFile.result['*']} FROM media_file
    WHERE media_reference_id = ${SCHEMA.params.media_reference_id}`

  #select_by_checksum = this.query`
    SELECT ${MediaFile.result['*']} FROM media_file
    WHERE checksum = ${SCHEMA.params.checksum}`

  create = this.query.one`INSERT INTO media_file (
    filepath,
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
    SCHEMA.params.filepath,
    SCHEMA.params.filename,
    SCHEMA.params.file_size_bytes,
    SCHEMA.params.checksum,
    SCHEMA.params.media_type,
    SCHEMA.params.content_type,
    SCHEMA.params.codec,
    SCHEMA.params.width,
    SCHEMA.params.height,
    SCHEMA.params.animated,
    SCHEMA.params.duration,
    SCHEMA.params.framerate,
    SCHEMA.params.media_reference_id,
  ]}) RETURNING ${SCHEMA.result.id}`

  #select_one_impl(params: {
    media_reference_id?: number
    checksum?: string
  }) {
    if (params.checksum !== undefined && Object.keys(params).length === 1) {
      return this.#select_by_checksum.one({checksum: params.checksum})
    }

    if (params.media_reference_id !== undefined && Object.keys(params).length === 1) {
      return this.#select_by_media_reference_id.one({media_reference_id: params.media_reference_id})
    }

    throw new Error('unimplemented')
  }

  public select_one = this.select_one_fn(this.#select_one_impl.bind(this))
}

export { MediaFile }
