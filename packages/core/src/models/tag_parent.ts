import * as torm from '@torm/sqlite'
import { Model, field } from '~/models/lib/base.ts'


class TagParent extends Model {
  static schema = torm.schema('tag_parent', {
    id:              field.number(),
    source_tag_slug: field.string(),
    target_tag_slug: field.string(),
    updated_at:      field.datetime(),
    created_at:      field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query.one`
    INSERT INTO tag_parent (source_tag_slug, target_tag_slug)
    VALUES (${[TagParent.params.source_tag_slug, TagParent.params.target_tag_slug]})
    RETURNING ${TagParent.result.id}`

  #delete_by_id = this.query.exec`
    DELETE FROM tag_parent WHERE id = ${TagParent.params.id}`

  #select_by_id = this.query`
    SELECT ${TagParent.result['*']} FROM tag_parent
    WHERE id = ${TagParent.params.id}`

  /** Select children of a parent tag (source is child, target is parent) */
  #select_children = this.query`
    SELECT ${TagParent.result['*']} FROM tag_parent
    WHERE target_tag_slug = ${TagParent.params.target_tag_slug}`

  /** Select parents of a child tag */
  #select_parents = this.query`
    SELECT ${TagParent.result['*']} FROM tag_parent
    WHERE source_tag_slug = ${TagParent.params.source_tag_slug}`

  #update_source_slug = this.query.exec`
    UPDATE tag_parent SET source_tag_slug = ${TagParent.params.source_tag_slug}
    WHERE source_tag_slug = ${TagParent.params.target_tag_slug}`

  #update_target_slug = this.query.exec`
    UPDATE tag_parent SET target_tag_slug = ${TagParent.params.target_tag_slug}
    WHERE target_tag_slug = ${TagParent.params.source_tag_slug}`

  public create = this.create_fn(this.#create)

  public delete = this.delete_fn(this.#delete_by_id)

  public select_one = this.select_one_fn(this.#select_by_id.one)

  /** Get child tag slugs for a parent */
  public select_children(params: { target_tag_slug: string }) {
    return this.#select_children.all(params)
  }

  /** Get parent tag slugs for a child */
  public select_parents(params: { source_tag_slug: string }) {
    return this.#select_parents.all(params)
  }

  /** Rename a slug across all parent rows where it appears as source (child) */
  public update_source_slug(params: { source_tag_slug: string; target_tag_slug: string }) {
    return this.#update_source_slug({ source_tag_slug: params.source_tag_slug, target_tag_slug: params.target_tag_slug })
  }

  /** Rename a slug across all parent rows where it appears as target (parent) */
  public update_target_slug(params: { source_tag_slug: string; target_tag_slug: string }) {
    return this.#update_target_slug({ source_tag_slug: params.source_tag_slug, target_tag_slug: params.target_tag_slug })
  }
}

export { TagParent }
