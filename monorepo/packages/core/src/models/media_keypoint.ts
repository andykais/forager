import * as torm from '@torm/sqlite'
import * as errors from '~/lib/errors.ts'
import { Model, field, PaginationVars, type PaginatedResult } from '~/models/lib/base.ts'
import { MediaReference } from '~/models/media_reference.ts'

class MediaKeypoint extends Model {
  static schema = torm.schema('media_keypoint', {
    id:                 field.number(),
    media_timestamp:    field.number(),
    duration:           field.number(),
    media_reference_id: field.number(),
    tag_id:             field.number(),
    updated_at:         field.datetime(),
    created_at:         field.datetime(),
  })
  static params = MediaKeypoint.schema.params
  static result = MediaKeypoint.schema.result

  #create = this.query.one`INSERT INTO media_keypoint (
    media_reference_id,
    tag_id,
    media_timestamp,
    duration
  ) VALUES (${[
    MediaKeypoint.params.media_reference_id,
    MediaKeypoint.params.tag_id,
    MediaKeypoint.params.media_timestamp,
    MediaKeypoint.params.duration,
  ]}) RETURNING ${MediaKeypoint.result['*']}`

  #select_by_tag_and_media_reference = this.query`
    SELECT ${MediaKeypoint.result['*']}
    FROM media_keypoint
    WHERE media_reference_id = ${MediaKeypoint.params.media_reference_id} AND tag_id = ${MediaKeypoint.params.tag_id}`

  public create = this.create_fn(this.#create)

  public select_one = this.select_one_fn(this.#select_by_tag_and_media_reference.one)
}

export { MediaKeypoint }