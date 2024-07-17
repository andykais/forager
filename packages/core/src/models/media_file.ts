import * as torm from '@torm/sqlite'
import { Model, field } from '~/models/lib/base.ts'

class MediaFile extends Model {
  static schema = torm.schema('media_file', {
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
  static params = this.schema.params
  static result = this.schema.result

  #select_by_media_reference_id = this.query`
    SELECT ${MediaFile.result['*']} FROM media_file
    WHERE media_reference_id = ${MediaFile.params.media_reference_id}`

  #select_by_checksum = this.query`
    SELECT ${MediaFile.result['*']} FROM media_file
    WHERE checksum = ${MediaFile.params.checksum}`

  #create = this.query.one`INSERT INTO media_file (
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
    MediaFile.params.filepath,
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

  public create = this.create_fn(this.#create)
}

export { MediaFile }
