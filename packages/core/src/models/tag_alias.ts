import * as torm from '@torm/sqlite'
import { Model, field } from '~/models/lib/base.ts'


class TagAlias extends Model {
  static schema = torm.schema('tag_alias', {
    id:              field.number(),
    /** The slug of the tag that is only an alias (will have zero media_reference_tag rows) */
    source_tag_slug: field.string(),
    /** The slug of the canonical tag that persists and receives all media associations */
    target_tag_slug: field.string(),
    updated_at:      field.datetime(),
    created_at:      field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query.one`
    INSERT INTO tag_alias (source_tag_slug, target_tag_slug)
    VALUES (${[TagAlias.params.source_tag_slug, TagAlias.params.target_tag_slug]})
    RETURNING ${TagAlias.result.id}`

  #delete_by_id = this.query.exec`
    DELETE FROM tag_alias WHERE id = ${TagAlias.params.id}`

  #select_by_id = this.query`
    SELECT ${TagAlias.result['*']} FROM tag_alias
    WHERE id = ${TagAlias.params.id}`

  #select_by_source = this.query`
    SELECT ${TagAlias.result['*']} FROM tag_alias
    WHERE source_tag_slug = ${TagAlias.params.source_tag_slug}`

  #select_by_target = this.query`
    SELECT ${TagAlias.result['*']} FROM tag_alias
    WHERE target_tag_slug = ${TagAlias.params.target_tag_slug}`

  #update_source_slug = this.query.exec`
    UPDATE tag_alias SET source_tag_slug = ${TagAlias.params.source_tag_slug}
    WHERE source_tag_slug = ${TagAlias.params.target_tag_slug}`

  #update_target_slug = this.query.exec`
    UPDATE tag_alias SET target_tag_slug = ${TagAlias.params.target_tag_slug}
    WHERE target_tag_slug = ${TagAlias.params.source_tag_slug}`

  public create = this.create_fn(this.#create)

  public delete = this.delete_fn(this.#delete_by_id)

  public select_one = this.select_one_fn(this.#select_by_id.one)

  /** Get the alias target for a source tag (what this tag is an alias of) */
  public select_by_source(params: { source_tag_slug: string }) {
    return this.#select_by_source.one(params)
  }

  /** Get all aliases that point to a canonical tag */
  public select_all_by_target(params: { target_tag_slug: string }) {
    return this.#select_by_target.all(params)
  }

  /** Rename a slug across all alias rows where it appears as source */
  public update_source_slug(params: { source_tag_slug: string; target_tag_slug: string }) {
    return this.#update_source_slug({ source_tag_slug: params.source_tag_slug, target_tag_slug: params.target_tag_slug })
  }

  /** Rename a slug across all alias rows where it appears as target */
  public update_target_slug(params: { source_tag_slug: string; target_tag_slug: string }) {
    return this.#update_target_slug({ source_tag_slug: params.source_tag_slug, target_tag_slug: params.target_tag_slug })
  }
}

export { TagAlias }
