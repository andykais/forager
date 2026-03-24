import * as torm from '@torm/sqlite'
import { Model, field } from '~/models/lib/base.ts'
import { Tag, TagGroup } from "~/models/mod.ts";


class TagParent extends Model {
  static schema = torm.schema('tag_parent', {
    id:              field.number(),
    /** The slug of the child tag — when this tag is applied to media, the parent is also included */
    child_tag_slug:  field.string(),
    /** The slug of the parent tag that is automatically applied whenever the child tag is applied */
    parent_tag_slug: field.string(),
    updated_at:      field.datetime(),
    created_at:      field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query.one`
    INSERT INTO tag_parent (child_tag_slug, parent_tag_slug)
    VALUES (${[TagParent.params.child_tag_slug, TagParent.params.parent_tag_slug]})
    RETURNING ${TagParent.result.id}`

  #delete_by_id = this.query.exec`
    DELETE FROM tag_parent WHERE id = ${TagParent.params.id}`

  #select_by_id = this.query`
    SELECT ${TagParent.result['*']} FROM tag_parent
    WHERE id = ${TagParent.params.id}`

  #select_children = this.query`
    SELECT ${TagParent.result['*']} FROM tag_parent
    WHERE parent_tag_slug = ${TagParent.params.parent_tag_slug}`

  #select_children_with_tags = this.query`
    SELECT ${Tag.result['*']}, ${TagGroup.result.color}, ${TagGroup.result.name.as('group')}, ${TagParent.result.id.as('rule_id')} FROM tag_parent
    INNER JOIN tag ON tag.slug = tag_parent.child_tag_slug
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    WHERE parent_tag_slug = ${TagParent.params.parent_tag_slug}`

  #select_parents = this.query`
    SELECT ${TagParent.result['*']} FROM tag_parent
    WHERE child_tag_slug = ${TagParent.params.child_tag_slug}`

  #select_parents_with_tags = this.query`
    SELECT ${Tag.result['*']}, ${TagGroup.result.color}, ${TagGroup.result.name.as('group')}, ${TagParent.result.id.as('rule_id')} FROM tag_parent
    INNER JOIN tag ON tag.slug = tag_parent.parent_tag_slug
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    WHERE child_tag_slug = ${TagParent.params.child_tag_slug}`

  #update_child_slug = this.query.exec`
    UPDATE tag_parent SET child_tag_slug = ${TagParent.params.child_tag_slug}
    WHERE child_tag_slug = ${TagParent.params.parent_tag_slug}`

  #update_parent_slug = this.query.exec`
    UPDATE tag_parent SET parent_tag_slug = ${TagParent.params.parent_tag_slug}
    WHERE parent_tag_slug = ${TagParent.params.child_tag_slug}`

  public create = this.create_fn(this.#create)

  public delete = this.delete_fn(this.#delete_by_id)

  public select_one = this.select_one_fn(this.#select_by_id.one)

  /** Get child tag slugs for a parent */
  public select_children(params: { parent_tag_slug: string }) {
    return this.#select_children.all(params)
  }

  /** Get child tag slugs for a parent with joined tags */
  public select_children_with_tags(params: { parent_tag_slug: string }) {
    return this.#select_children_with_tags.all(params)
  }

  /** Get parent tag slugs for a child */
  public select_parents(params: { child_tag_slug: string }) {
    return this.#select_parents.all(params)
  }

  /** Get parent tag slugs for a child with joined tags */
  public select_parents_with_tags(params: { child_tag_slug: string }) {
    return this.#select_parents_with_tags.all(params)
  }

  /** Rename a slug across all parent rows where it appears as child */
  public update_child_slug(params: { child_tag_slug: string; parent_tag_slug: string }) {
    return this.#update_child_slug(params)
  }

  /** Rename a slug across all parent rows where it appears as parent */
  public update_parent_slug(params: { child_tag_slug: string; parent_tag_slug: string }) {
    return this.#update_parent_slug(params)
  }
}

export { TagParent }
