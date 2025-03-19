import * as torm from '@torm/sqlite'
import { Model, field } from '~/models/lib/base.ts'


class MediaReferenceTag extends Model {
  static schema = torm.schema('media_reference_tag', {
    media_reference_id:           field.number(),
    tag_id:                       field.number(),
    tag_group_id:                 field.number(),
    // auto generated fields
    updated_at:                   field.datetime(),
    created_at:                   field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query`
    INSERT INTO media_reference_tag (
      media_reference_id,
      tag_id,
      tag_group_id
    ) VALUES (${[
      MediaReferenceTag.params.media_reference_id,
      MediaReferenceTag.params.tag_id,
      MediaReferenceTag.params.tag_group_id,
    ]}) RETURNING ${MediaReferenceTag.result['*']}`

  #select_one_by_media_reference_and_tag = this.query.one`
    SELECT ${MediaReferenceTag.result['*']} FROM media_reference_tag
    WHERE media_reference_id = ${MediaReferenceTag.params.media_reference_id} AND tag_id = ${MediaReferenceTag.params.tag_id}`

  #delete_by_media_reference = this.query.exec`
    DELETE FROM media_reference_tag
    WHERE media_reference_id = ${MediaReferenceTag.params.media_reference_id}`

  // NOTE SQLite doesnt support LIMIT on DELETE commands, we could make this query fancier to support that, but since we have media_reference_id and tag_id filters, and there is a unique constraint on those two, we should be fine here
  #delete_by_media_reference_and_tag = this.query.exec`
    DELETE FROM media_reference_tag
    WHERE media_reference_id = ${MediaReferenceTag.params.media_reference_id} AND tag_id = ${MediaReferenceTag.params.tag_id}`

  #delete_impl(params: {
    media_reference_id: number
    tag_id?: number
  }) {
    const { tag_id, media_reference_id } = params
    if (tag_id !== undefined) {
      return this.#delete_by_media_reference_and_tag({tag_id, media_reference_id})
    } else {
      return this.#delete_by_media_reference({media_reference_id: media_reference_id})
    }
  }

  public create = this.create_fn(this.#create.one)

  public delete = this.delete_fn(this.#delete_impl.bind(this))

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
