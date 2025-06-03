import * as torm from '@torm/sqlite'
import { Model, field, PaginatedResult, PaginationVars } from '~/models/lib/base.ts'
import {TagGroup} from './tag_group.ts'
import {MediaReferenceTag} from './media_reference_tag.ts'
import {MediaReference, SelectManyFilters} from './media_reference.ts'
import { SQLBuilder } from "~/models/lib/sql_builder.ts";

export type TagJoin =
  & torm.InferSchemaTypes<typeof Tag.result>
  & {
    group: torm.InferSchemaTypes<typeof TagGroup.result>['name']
    color: torm.InferSchemaTypes<typeof TagGroup.result>['color']
  }

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
    ]}) RETURNING ${Tag.result.id}, ${Tag.result.tag_group_id}`

  #count = this.query`
    SELECT COUNT(1) AS ${PaginationVars.result.total} FROM tag`

  #select = this.query`
    SELECT ${Tag.result['*']}, ${TagGroup.result.name.as('group')}, ${TagGroup.result.color} FROM tag
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id`

  #select_by_id = this.query`
    SELECT ${Tag.result['*']}, ${TagGroup.result.name.as('group')}, ${TagGroup.result.color} FROM tag
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    WHERE tag.id = ${Tag.params.id}`

  #select_by_tag_group_and_name = this.query`
    SELECT ${Tag.result['*']}, ${TagGroup.result.name.as('group')}, ${TagGroup.result.color} FROM tag
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    WHERE tag.name = ${Tag.params.name} AND tag_group.name = ${TagGroup.params.name.as('group')}`

  #select_by_tag_group_id_and_name = this.query`
    SELECT ${Tag.result['*']}, ${TagGroup.result.name.as('group')}, ${TagGroup.result.color} FROM tag
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    WHERE tag_group_id = ${Tag.params.tag_group_id} AND tag.name = ${Tag.params.name}`

  #select_by_media_reference_id = this.query`
    SELECT ${Tag.result['*']}, ${TagGroup.result.name.as('group')}, ${TagGroup.result.color} FROM tag
    INNER JOIN media_reference_tag ON media_reference_tag.tag_id = tag.id
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    WHERE media_reference_tag.media_reference_id = ${MediaReferenceTag.params.media_reference_id}
    ORDER BY tag.media_reference_count DESC, tag.updated_at DESC, tag.id DESC`
  #delete_by_count = this.query`
    DELETE FROM tag
    WHERE tag.media_reference_count = 0`

  #select_one_impl(params: {
    id?: number
    name?: string
    tag_group_id?: number
    group?: string
  }): (torm.InferSchemaTypes<typeof Tag.result> & {group: string; color: string}) | undefined {
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

  public select_paginated(params: {
    limit: number
    cursor: PaginatedResult<unknown>['cursor']
    sort_by: 'unread_media_reference_count' | 'media_reference_count' | 'created_at' | 'updated_at'
    tag_match?: {
      name: string
      group: string | undefined
    } | undefined
    contextual_query: SelectManyFilters | undefined
  }): PaginatedResult<TagJoin> {
    if (params.cursor !== undefined) {
      throw new Error('unimplemented')
    }

    const tags_sql_builder = new SQLBuilder(this.driver)
    tags_sql_builder
      .set_select_clause(`SELECT tag.*, tag_group.name as 'group', tag_group.color as 'color' FROM tag`)
      .add_join_clause('INNER JOIN', 'tag_group', 'tag_group.id = tag.tag_group_id')
      .set_limit_clause(`LIMIT ${params.limit}`)
      .add_result_fields([...Tag.result['*'] as any, TagGroup.result.name.as('group')] as any)
      .add_result_fields([
        ...Tag.result['*'] as any,
        TagGroup.result.name.as('group'),
        TagGroup.result.color,
      ])

      if (params.sort_by === 'media_reference_count') {
        tags_sql_builder.set_order_by_clause(`ORDER BY tag.media_reference_count DESC, tag.updated_at DESC, tag.id DESC`)
      } else if (params.sort_by === 'unread_media_reference_count') {
        tags_sql_builder.set_order_by_clause(`ORDER BY tag.unread_media_reference_count DESC, tag.updated_at DESC, tag.id DESC`)
      } else if (params.sort_by === 'updated_at') {
        tags_sql_builder.set_order_by_clause(`ORDER BY tag.updated_at DESC, tag.id DESC`)
      } else if (params.sort_by === 'created_at') {
        tags_sql_builder.set_order_by_clause(`ORDER BY tag.created_at DESC, tag.id DESC`)
      } else {
        throw new Error(`unexpected tag sort_by: ${params.sort_by}`)
      }

    if (params.tag_match) {
      const {name, group} = params.tag_match
      if (group === undefined) {
        tags_sql_builder.add_where_clause(`tag.name GLOB '${name}'`)
      } else {
        tags_sql_builder.add_where_clause(`tag.name GLOB '${name}' AND tag_group.name GLOB '${group}'`)
      }
    }

    let results: TagJoin[]
    let total = -1
    if (params.contextual_query && Object.keys(params.contextual_query)) {

      const media_reference_tag_builder = new SQLBuilder(this.driver)
      media_reference_tag_builder.set_select_clause(`SELECT media_reference_tag.media_reference_id FROM media_reference`)
      media_reference_tag_builder.add_join_clause(`INNER JOIN`, 'media_reference_tag', 'media_reference_tag.media_reference_id = media_reference.id')
      MediaReference.set_select_many_filters(media_reference_tag_builder, params.contextual_query)

      tags_sql_builder
        .add_join_clause('INNER JOIN', 'media_reference_tag', 'media_reference_tag.tag_id = tag.id')
        .add_join_clause('INNER JOIN', `(
          ${media_reference_tag_builder.generate_sql()}
        ) M`, 'M.media_reference_id = media_reference_tag.media_reference_id')
        .add_group_clause(`GROUP BY tag.id`)
    }

    const select_tags = tags_sql_builder.build()

    tags_sql_builder
      .set_select_clause(`SELECT COUNT(DISTINCT(tag.id)) as total FROM tag`)
      .set_result_fields({total: PaginationVars.result.total})
      .clear_group_clause()
    const count_tags = tags_sql_builder.build()

    results = select_tags.stmt.all({})
    total = count_tags.stmt.one({})!.total

    return {
      results,
      // TODO this sets up the contract, we dont need to build this now though
      total,
      cursor: undefined,
    }
  }

  public select_all(params: {
    media_reference_id: number,
  }): TagJoin[] {
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

  public delete_unreferenced() {
    this.#delete_by_count.exec()
  }
}

export { Tag }
