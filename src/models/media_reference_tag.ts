import * as torm from '@torm/sqlite'
import { Model, field } from '~/models/lib/base.ts'


class MediaReferenceTag extends Model {
  static schema = torm.schema('media_reference_tag', {
    media_reference_id:           field.number(),
    tag_id:                       field.number(),
    // auto generated fields
    updated_at:                   field.datetime(),
    created_at:                   field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query`
    INSERT INTO media_reference_tag (
      media_reference_id,
      tag_id
    ) VALUES (${[
      MediaReferenceTag.params.media_reference_id,
      MediaReferenceTag.params.tag_id,
    ]}) RETURNING ${MediaReferenceTag.result.media_reference_id}, ${MediaReferenceTag.result.tag_id}`

  create = this.create_fn(this.#create.one)
}

export { MediaReferenceTag }
