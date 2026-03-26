import * as torm from '@torm/sqlite'
import { Model, field, PaginationVars } from '~/models/lib/base.ts'
import { Tag } from '~/models/tag.ts'
import { TagGroup } from "./tag_group.ts";


class TagAlias extends Model {
  static schema = torm.schema('tag_alias', {
    id:                 field.number(),
    /** The slug of the tag that is only an alias (will have zero media_reference_tag rows) */
    alias_tag_slug:     field.string(),
    /** The slug of the canonical tag that persists and receives all media associations */
    alias_for_tag_slug: field.string(),
    updated_at:         field.datetime(),
    created_at:         field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query.one`
    INSERT INTO tag_alias (alias_tag_slug, alias_for_tag_slug)
    VALUES (${[TagAlias.params.alias_tag_slug, TagAlias.params.alias_for_tag_slug]})
    RETURNING ${TagAlias.result.id}`

  #delete_by_id = this.query.exec`
    DELETE FROM tag_alias WHERE id = ${TagAlias.params.id}`

  #select_by_id = this.query`
    SELECT ${TagAlias.result['*']} FROM tag_alias
    WHERE id = ${TagAlias.params.id}`

  #select_by_alias = this.query`
    SELECT ${TagAlias.result['*']} FROM tag_alias
    WHERE alias_tag_slug = ${TagAlias.params.alias_tag_slug}`

  #select_by_alias_with_tags = this.query`
    SELECT ${Tag.result['*']}, ${TagGroup.result.name.as('group')}, ${TagGroup.result.color}, ${TagAlias.result.id.as('rule_id')} FROM tag_alias
    INNER JOIN tag ON tag.slug = tag_alias.alias_for_tag_slug
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    WHERE alias_tag_slug = ${TagAlias.params.alias_tag_slug}`

  #select_by_alias_for_with_tags = this.query`
    SELECT ${Tag.result['*']}, ${TagGroup.result.name.as('group')}, ${TagGroup.result.color}, ${TagAlias.result.id.as('rule_id')} FROM tag_alias
    INNER JOIN tag ON tag.slug = tag_alias.alias_tag_slug
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    WHERE alias_for_tag_slug = ${TagAlias.params.alias_for_tag_slug}`

  #count_by_alias = this.query`
    SELECT COUNT(1) AS ${PaginationVars.result.total} FROM tag_alias
    WHERE alias_tag_slug = ${TagAlias.params.alias_tag_slug}`

  #count_by_alias_for = this.query`
    SELECT COUNT(1) AS ${PaginationVars.result.total} FROM tag_alias
    WHERE alias_for_tag_slug = ${TagAlias.params.alias_for_tag_slug}`

  #update_alias_slug = this.query.exec`
    UPDATE tag_alias SET alias_tag_slug = ${TagAlias.params.alias_tag_slug}
    WHERE alias_tag_slug = ${TagAlias.params.alias_for_tag_slug}`

  #update_alias_for_slug = this.query.exec`
    UPDATE tag_alias SET alias_for_tag_slug = ${TagAlias.params.alias_for_tag_slug}
    WHERE alias_for_tag_slug = ${TagAlias.params.alias_tag_slug}`

  public create = this.create_fn(this.#create)

  public delete = this.delete_fn(this.#delete_by_id)

  public select_one = this.select_one_fn(this.#select_by_id.one)

  /** Get the alias rule for a tag that is an alias (what it's an alias for) */
  public select_by_alias(params: { alias_tag_slug: string }) {
    return this.#select_by_alias.one(params)
  }

  public select_by_alias_with_tags(params: { alias_tag_slug: string }) {
    return this.#select_by_alias_with_tags.one(params)
  }

  public select_all_by_alias_for_with_tags(params: { alias_for_tag_slug: string }) {
    return this.#select_by_alias_for_with_tags.all(params)
  }

  /** Count alias rules where this tag is the alias */
  public count_by_alias(params: { alias_tag_slug: string }): number {
    return this.#count_by_alias.one(params)!.total
  }

  /** Count alias rules pointing to a canonical tag */
  public count_by_alias_for(params: { alias_for_tag_slug: string }): number {
    return this.#count_by_alias_for.one(params)!.total
  }

  /** Rename a slug across all alias rows where it appears as the alias */
  public update_alias_slug(params: { alias_tag_slug: string; alias_for_tag_slug: string }) {
    return this.#update_alias_slug(params)
  }

  /** Rename a slug across all alias rows where it appears as the canonical tag */
  public update_alias_for_slug(params: { alias_tag_slug: string; alias_for_tag_slug: string }) {
    return this.#update_alias_for_slug(params)
  }
}

export { TagAlias }
