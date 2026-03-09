import { Actions } from '~/actions/lib/base.ts'
import { type inputs, parsers } from '~/inputs/mod.ts'
import type { SelectManyFilters } from '~/models/media_reference.ts'
import { tag_slug_format } from '~/inputs/tag_inputs.ts'
import { get_hash_color } from '~/lib/text_processor.ts'
import * as errors from '~/lib/errors.ts'
import type * as result_types from '~/models/lib/result_types.ts'


interface TagRuleRef {
  slug: string
  tag?: result_types.Tag
}

/**
 * The full detail view for a single tag, including alias and parent/child relationships.
 */
export interface TagDetail {
  tag: result_types.Tag
  aliases: TagRuleRef[]
  alias_target: TagRuleRef | null
  children: TagRuleRef[]
  parents: TagRuleRef[]
}


/**
  * Actions associated with tag management in forager
  */
class TagActions extends Actions {

  /**
   * Search for tags with optional filtering and pagination.
   */
  search = (params?: inputs.TagSearch) => {
    const parsed = parsers.TagSearch.parse(params ?? {})

    let contextual_query: undefined | SelectManyFilters
    if (parsed?.contextual_query && Object.keys(parsed.contextual_query).length) {
      const tag_ids: number[] | undefined = parsed.contextual_query.tags
        ?.map(tag => this.models.Tag.select_one({name: tag.name, group: tag.group }, {or_raise: true}).id)
        .filter((tag): tag is number => tag !== undefined)

      contextual_query = {
        animated: parsed.contextual_query.animated,
        cursor: undefined,
        filepath: parsed.contextual_query.filepath,
        id: undefined,
        keypoint_tag_id: undefined,
        limit: undefined,
        order: undefined,
        series: parsed.contextual_query.series,
        series_id: parsed.contextual_query.series_id,
        sort_by: 'created_at',
        stars: parsed.contextual_query.stars,
        stars_equality: parsed.contextual_query.stars_equality,
        duration_min: parsed.contextual_query.duration?.min?.seconds,
        duration_max: parsed.contextual_query.duration?.max?.seconds,
        unread: parsed.contextual_query.unread,
        tag_ids: tag_ids,
      }
    }

    return this.models.Tag.select_paginated({
      sort_by: parsed.sort_by,
      limit: parsed.limit,
      cursor: parsed.cursor,
      tag_match: parsed.query.tag_match,
      contextual_query: contextual_query,
    })
  }

  /**
   * Get a single tag by slug with its full relationship graph (aliases, parents, children).
   */
  get = (params: inputs.TagGet): TagDetail => {
    const parsed = parsers.TagGet.parse(params)
    const tag = this.models.Tag.select_one({ slug: parsed.slug }, { or_raise: true })

    const alias_target_row = this.models.TagAlias.select_by_source({ source_tag_slug: tag.slug })
    const alias_rows = this.models.TagAlias.select_all_by_target({ target_tag_slug: tag.slug })
    const child_rows = this.models.TagParent.select_children({ target_tag_slug: tag.slug })
    const parent_rows = this.models.TagParent.select_parents({ source_tag_slug: tag.slug })

    const resolve_slug = (slug: string): TagRuleRef => {
      const resolved = this.models.Tag.select_one({ slug })
      return resolved ? { slug, tag: resolved } : { slug }
    }

    return {
      tag,
      alias_target: alias_target_row ? resolve_slug(alias_target_row.target_tag_slug) : null,
      aliases: alias_rows.map(row => resolve_slug(row.source_tag_slug)),
      children: child_rows.map(row => resolve_slug(row.source_tag_slug)),
      parents: parent_rows.map(row => resolve_slug(row.target_tag_slug)),
    }
  }

  /**
   * Update a tag's name, group, and/or description. If name or group changes, the slug is
   * recomputed and any tag_alias/tag_parent rows referencing the old slug are updated.
   */
  update = (params: inputs.TagUpdate): void => {
    const parsed = parsers.TagUpdate.parse(params)
    const tag = this.models.Tag.select_one({ slug: parsed.slug }, { or_raise: true })

    const new_name = parsed.name ?? tag.name
    const new_group = parsed.group ?? tag.group
    const new_slug = tag_slug_format({ name: new_name, group: new_group })

    let new_tag_group_id: number | undefined
    if (parsed.group !== undefined && parsed.group !== tag.group) {
      const color = get_hash_color(parsed.group, 'hsl')
      const tag_group = this.models.TagGroup.get_or_create({ name: parsed.group, color })!
      new_tag_group_id = tag_group.id
    }

    if (new_slug !== tag.slug) {
      const existing = this.models.Tag.select_one({ slug: new_slug })
      if (existing) {
        throw new errors.BadInputError(`Tag with slug '${new_slug}' already exists`)
      }
    }

    this.models.Tag.update({
      id: tag.id,
      name: new_name,
      tag_group_id: new_tag_group_id ?? tag.tag_group_id,
      slug: new_slug,
      description: parsed.description ?? tag.description,
    })

    if (new_slug !== tag.slug) {
      this.models.TagAlias.update_source_slug({ source_tag_slug: new_slug, target_tag_slug: tag.slug })
      this.models.TagAlias.update_target_slug({ source_tag_slug: tag.slug, target_tag_slug: new_slug })
      this.models.TagParent.update_source_slug({ source_tag_slug: new_slug, target_tag_slug: tag.slug })
      this.models.TagParent.update_target_slug({ source_tag_slug: tag.slug, target_tag_slug: new_slug })
    }
  }

  /**
   * Create an alias relationship. The source tag becomes an alias for the target (canonical) tag.
   * Any existing media_reference_tag rows on the source are migrated to the target.
   */
  alias_create = (params: inputs.TagAliasCreate): { id: number } => {
    const parsed = parsers.TagAliasCreate.parse(params)

    if (parsed.source_tag_slug === parsed.target_tag_slug) {
      throw new errors.BadInputError(`A tag cannot be an alias of itself`)
    }

    const existing_alias = this.models.TagAlias.select_by_source({ source_tag_slug: parsed.source_tag_slug })
    if (existing_alias) {
      throw new errors.BadInputError(`Tag '${parsed.source_tag_slug}' is already an alias of '${existing_alias.target_tag_slug}'`)
    }

    const target_is_alias = this.models.TagAlias.select_by_source({ source_tag_slug: parsed.target_tag_slug })
    if (target_is_alias) {
      throw new errors.BadInputError(`Tag '${parsed.target_tag_slug}' is itself an alias of '${target_is_alias.target_tag_slug}' and cannot be a canonical tag`)
    }

    const { id } = this.models.TagAlias.create({
      source_tag_slug: parsed.source_tag_slug,
      target_tag_slug: parsed.target_tag_slug,
    })

    this.#migrate_alias_tags(parsed.source_tag_slug, parsed.target_tag_slug)

    return { id }
  }

  /**
   * Delete an alias relationship by ID.
   */
  alias_delete = (params: inputs.TagAliasDelete): void => {
    const parsed = parsers.TagAliasDelete.parse(params)
    this.models.TagAlias.select_one({ id: parsed.id }, { or_raise: true })
    this.models.TagAlias.delete({ id: parsed.id }, { expected_deletes: 1 })
  }

  /**
   * Create a parent/child relationship. The source tag (child) is implicitly included
   * when the target tag (parent) is applied.
   */
  parent_create = (params: inputs.TagParentCreate): { id: number } => {
    const parsed = parsers.TagParentCreate.parse(params)

    if (parsed.source_tag_slug === parsed.target_tag_slug) {
      throw new errors.BadInputError(`A tag cannot be its own parent`)
    }

    // Check for circular parent chains: target must not already be a descendant of source
    this.#check_circular_parents(parsed.source_tag_slug, parsed.target_tag_slug)

    const { id } = this.models.TagParent.create({
      source_tag_slug: parsed.source_tag_slug,
      target_tag_slug: parsed.target_tag_slug,
    })

    return { id }
  }

  /**
   * Delete a parent/child relationship by ID.
   */
  parent_delete = (params: inputs.TagParentDelete): void => {
    const parsed = parsers.TagParentDelete.parse(params)
    this.models.TagParent.select_one({ id: parsed.id }, { or_raise: true })
    this.models.TagParent.delete({ id: parsed.id }, { expected_deletes: 1 })
  }

  /**
   * Migrate media_reference_tag rows from the source (alias) tag to the target (canonical) tag.
   * Uses delete + get_or_create to properly trigger count updates.
   */
  #migrate_alias_tags(source_slug: string, target_slug: string) {
    const source_tag = this.models.Tag.select_one({ slug: source_slug })
    if (!source_tag || source_tag.media_reference_count === 0) return

    const target_tag_record = this.models.Tag.select_one({ slug: target_slug })
    if (!target_tag_record) return

    const source_rows = this.models.MediaReferenceTag.select_all_by_tag_id({ tag_id: source_tag.id })
    for (const row of source_rows) {
      this.models.MediaReferenceTag.delete({ media_reference_id: row.media_reference_id, tag_id: source_tag.id })
      this.models.MediaReferenceTag.get_or_create({
        media_reference_id: row.media_reference_id,
        tag_id: target_tag_record.id,
        tag_group_id: target_tag_record.tag_group_id,
        editor: row.editor,
      })
    }
  }

  /** Walk the parent chain to detect circular references before inserting. */
  #check_circular_parents(source_slug: string, target_slug: string) {
    const visited = new Set<string>([source_slug])
    const queue = [target_slug]
    while (queue.length > 0) {
      const current = queue.pop()!
      if (visited.has(current)) {
        throw new errors.BadInputError(`Circular parent/child relationship detected: '${source_slug}' -> '${target_slug}' would create a cycle`)
      }
      visited.add(current)
      const parents = this.models.TagParent.select_parents({ source_tag_slug: current })
      for (const parent of parents) {
        queue.push(parent.target_tag_slug)
      }
    }
  }
}


export { TagActions }
