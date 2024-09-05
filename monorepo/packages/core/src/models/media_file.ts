import * as torm from '@torm/sqlite'
import { Model, field } from '~/models/lib/base.ts'

class MediaFile extends Model {
  static schema = torm.schema('media_file', {
    id:                       field.number(),
    media_reference_id:       field.number(),  // TODO support MediaReference.schema.id here
    filepath:                 field.string(),
    filename:                 field.string(),
    thumbnail_directory_path: field.string(),
    file_size_bytes:          field.number(),
    checksum:                 field.string(),
    media_type:               field.string(),  // TODO enum support
    codec:                    field.string(),
    content_type:             field.string(),
    width:                    field.number().optional(),
    height:                   field.number().optional(),
    animated:                 field.boolean(),
    audio:                    field.boolean(),
    duration:                 field.number(),
    framerate:                field.number(),
    updated_at:               field.datetime(),
    created_at:               field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #select_by_media_reference_id = this.query`
    SELECT ${MediaFile.result['*']} FROM media_file
    WHERE media_reference_id = ${MediaFile.params.media_reference_id}`

  #select_by_filepath = this.query`
    SELECT ${MediaFile.result['*']} FROM media_file
    WHERE filepath = ${MediaFile.params.filepath}`

  #select_by_checksum = this.query`
    SELECT ${MediaFile.result['*']} FROM media_file
    WHERE checksum = ${MediaFile.params.checksum}`

  #create = this.query.one`INSERT INTO media_file (
    filepath,
    filename,
    thumbnail_directory_path,
    file_size_bytes,
    checksum,
    media_type,
    content_type,
    codec,
    width,
    height,
    animated,
    audio,
    duration,
    framerate,
    media_reference_id
  ) VALUES (${[
    MediaFile.params.filepath,
    MediaFile.params.filename,
    MediaFile.params.thumbnail_directory_path,
    MediaFile.params.file_size_bytes,
    MediaFile.params.checksum,
    MediaFile.params.media_type,
    MediaFile.params.content_type,
    MediaFile.params.codec,
    MediaFile.params.width,
    MediaFile.params.height,
    MediaFile.params.animated,
    MediaFile.params.audio,
    MediaFile.params.duration,
    MediaFile.params.framerate,
    MediaFile.params.media_reference_id,
  ]}) RETURNING ${MediaFile.result.id}`

  #delete_by_id = this.query.exec`
    DELETE FROM media_file
    WHERE id = ${MediaFile.params.id}`

  #select_one_impl(params: {
    media_reference_id?: number
    filepath?: string
    checksum?: string
  }) {
    if (params.filepath !== undefined && Object.keys(params).length === 1) {
      return this.#select_by_filepath.one({filepath: params.filepath})
    }

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

  public delete = this.delete_fn(this.#delete_by_id)
}

export { MediaFile }
