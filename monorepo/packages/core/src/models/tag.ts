import * as torm from '@torm/sqlite'
import { Model, field } from '~/models/lib/base.ts'
import {TagGroup} from './tag_group.ts'
import {MediaReferenceTag} from './media_reference_tag.ts'

class Tag extends Model {
  static schema = torm.schema('tag', {
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
  })

  static params = this.schema.params
  static result = this.schema.result

  #create = this.query.one`
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

  #select_by_id = this.query`
    SELECT ${Tag.result['*']}, ${TagGroup.result.name.as('group')} FROM tag
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    WHERE tag.id = ${Tag.params.id}`

  #select_by_tag_group_and_name = this.query`
    SELECT ${Tag.result['*']}, ${TagGroup.result.name.as('group')} FROM tag
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    WHERE tag.name = ${Tag.params.name} AND tag_group.name = ${TagGroup.params.name.as('group')}`

  #select_by_tag_group_id_and_name = this.query`
    SELECT ${Tag.result['*']}, ${TagGroup.result.name.as('group')} FROM tag
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    WHERE tag_group_id = ${Tag.params.tag_group_id} AND tag.name = ${Tag.params.name}`

  #select_by_media_reference_id = this.query`
    SELECT ${Tag.result['*']} FROM tag
    INNER JOIN media_reference_tag ON media_reference_tag.tag_id = tag.id
    WHERE media_reference_tag.media_reference_id = ${MediaReferenceTag.params.media_reference_id}`

  #select_one_impl(params: {
    id?: number
    name?: string
    tag_group_id?: number
    group?: string
  }): torm.InferSchemaTypes<typeof Tag.result> | undefined {
    if (
      params.id !== undefined &&
      Object.keys(params).length === 1
    ) {
      return this.#select_by_id.one({id: params.id})
    } else if (
      params.name !== undefined &&
      params.group !== undefined &&
      Object.keys(params).length === 2
    ) {
      return this.#select_by_tag_group_and_name.one({name: params.name, group: params.group})
    } else if (
      params.name !== undefined &&
      params.tag_group_id !== undefined &&
      Object.keys(params).length === 2
    ) {
      return this.#select_by_tag_group_id_and_name.one({name: params.name, tag_group_id: params.tag_group_id})
    } else {
      throw new Error(`unimplemented`)
    }
  }

  public select_one = this.select_one_fn(this.#select_one_impl.bind(this))

  public create = this.create_fn(this.#create)

  public select_many(params: {media_reference_id: number}) {
    return this.#select_by_media_reference_id.all({media_reference_id: params.media_reference_id})
  }

  public get_or_create(params: Parameters<Tag['create']>[0]) {
    try {
      return this.create(params)!
    } catch (e) {
      if (e instanceof torm.errors.UniqueConstraintError) {
        return this.select_one({tag_group_id: params.tag_group_id, name: params.name}, {or_raise: true})
      } else {
        throw e
      }
    }
  }

}

export { Tag }