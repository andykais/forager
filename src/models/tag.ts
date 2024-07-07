import { Model, field, errors } from 'torm'
import {TagGroup} from './tag_group.ts'

class Tag extends Model('tag', {
  id:                           field.number(),
  name:                         field.string(),
  tag_group_id:                 field.number(), // TODO support schema references (TagGroup::schema::id)
  alias_tag_id:                 field.number().optional(), // TODO support lazy references? This is a Tag::schema::id
  description:                  field.string().optional(),
  metadata:                     field.json().optional(),
  media_reference_count:        field.number(),
  unread_media_reference_count: field.number(),
  // auto generated fields
  updated_at:                   field.datetime(),
  created_at:                   field.datetime(),

}) {
  create = this.query.one`
    INSERT INTO tag (
      tag_group_id,
      name,
      alias_tag_id,
      description,
      metadata
    ) VALUES (${[
        Tag.params.tag_group_id,
        Tag.params.name,
        Tag.params.alias_tag_id,
        Tag.params.description,
        Tag.params.metadata
    ]}) RETURNING ${Tag.result.id}`

  find_by_group_and_name = this.query.one`
    SELECT ${Tag.result['*']} FROM tag
    WHERE tag_group_id = ${Tag.params.tag_group_id} AND name = ${Tag.params.name}`

  get_or_create(params: Parameters<Tag['create']>[0]) {
    try {
      return this.create(params)!
    } catch (e) {
      if (e instanceof errors.UniqueConstraintError) {
        return this.find_by_group_and_name({tag_group_id: params.tag_group_id, name: params.name})
      } else {
        throw e
      }
    }
  }
}

export { Tag }
