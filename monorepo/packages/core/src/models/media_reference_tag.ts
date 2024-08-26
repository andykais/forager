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

  #select_one_by_media_reference_and_tag = this.query.one`
    SELECT ${MediaReferenceTag.result['*']} FROM media_reference_tag
    WHERE media_reference_id = ${MediaReferenceTag.params.media_reference_id} AND tag_id = ${MediaReferenceTag.params.tag_id}`

  #delete_by_media_reference_id = this.query.exec`
    DELETE FROM media_reference_tag
    WHERE media_reference_id = ${MediaReferenceTag.params.media_reference_id}`

  public create = this.create_fn(this.#create.one)

  public delete = this.delete_fn(this.#delete_by_media_reference_id)

  public select_one = this.select_one_fn(this.#select_one_by_media_reference_and_tag)

  public get_or_create(params: Parameters<MediaReferenceTag['create']>[0]) {
    try {
      return this.create(params)
    } catch (e) {
      if (e instanceof torm.errors.UniqueConstraintError) {
        return this.select_one({ media_reference_id: params.media_reference_id, tag_id: params.tag_id }, {or_raise: true})
      } else {
        throw e
      }
    }
  }
}

export { MediaReferenceTag }
