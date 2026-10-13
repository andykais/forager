import * as torm from '@torm/sqlite'
import { Model, field } from '~/models/lib/base.ts'
import { TIMESTAMP_SQLITE } from '~/db/migrations/registry.ts'

class MediaFilepath extends Model {
  static schema = torm.schema('media_filepath', {
    id:            field.number(),
    media_file_id: field.number(),
    filepath:      field.string(),
    filename:      field.string(),
    updated_at:    field.datetime(),
    created_at:    field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query.one`INSERT INTO media_filepath (
    media_file_id,
    filepath,
    filename
  ) VALUES (${[
    MediaFilepath.params.media_file_id,
    MediaFilepath.params.filepath,
    MediaFilepath.params.filename,
  ]}) RETURNING ${MediaFilepath.result.id}`

  #select_by_filepath = this.query`
    SELECT ${MediaFilepath.result['*']} FROM media_filepath
    WHERE filepath = ${MediaFilepath.params.filepath}`

  #select_many_by_media_file_id = this.query`
    SELECT ${MediaFilepath.result['*']} FROM media_filepath
    WHERE media_file_id = ${MediaFilepath.params.media_file_id}
    ORDER BY id`

  #update_filepath_by_id = this.query.exec`
    UPDATE media_filepath SET
      filepath = ${MediaFilepath.params.filepath},
      filename = ${MediaFilepath.params.filename},
      updated_at = ${TIMESTAMP_SQLITE}
    WHERE id = ${MediaFilepath.params.id}`

  #delete_by_media_file_id = this.query.exec`
    DELETE FROM media_filepath
    WHERE media_file_id = ${MediaFilepath.params.media_file_id}`

  #select_one_impl(params: { filepath: string }) {
    return this.#select_by_filepath.one(params)
  }

  public select_one = this.select_one_fn(this.#select_one_impl.bind(this))

  public select_many(params: { media_file_id: number }) {
    return this.#select_many_by_media_file_id.all(params)
  }

  public create = this.create_fn(this.#create)

  public update_filepath = this.#update_filepath_by_id

  public delete = this.delete_fn(this.#delete_by_media_file_id)
}

export { MediaFilepath }
