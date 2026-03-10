import { Actions } from '~/actions/lib/base.ts'
import { type inputs, parsers } from '~/inputs/mod.ts'
import type { SelectManyFilters } from '~/models/media_reference.ts'
import { tag_slug_format } from '~/inputs/tag_inputs.ts'
import { get_hash_color } from '~/lib/text_processor.ts'
import * as errors from '~/lib/errors.ts'
import type * as result_types from '~/models/lib/result_types.ts'


interface TagWithRuleId extends result_types.Tag {
  rule_id: number
}

/**
 * The full detail view for a single tag, including alias and parent/child relationships.
 */
export interface TagDetail {
  /** The tag record itself with group name, color, and slug */
  tag: result_types.Tag
  /** Tags that are aliases pointing to this tag (this tag is the canonical version), with their alias rule IDs */
  aliases: TagWithRuleId[]
  /** If this tag is an alias, the canonical tag it resolves to (with rule ID); null if this tag is not an alias */
  alias_for: TagWithRuleId | null
  /** Tags that are automatically included when this tag is applied (this tag is the parent), with their parent rule IDs */
  children: TagWithRuleId[]
  /** Tags that, when applied, automatically include this tag (this tag is the child), with their parent rule IDs */
  parents: TagWithRuleId[]
}

export interface TagAliasResponse {
  /** Detail view for the alias tag (the tag being aliased away); null if the tag has no DB record yet */
  alias: TagDetail | null
  /** Detail view for the canonical tag that the alias resolves to */
  alias_for: TagDetail
  rule: result_types.TagAlias
}

export interface TagParentResponse {
  /** Detail view for the parent tag */
  parent: TagDetail
  /** Detail view for the child tag; null if the tag has no DB record yet */
  child: TagDetail | null
  rule: result_types.TagParent
}

export interface TagSearchResultItem extends result_types.Tag {
  /** Number of alias rules involving this tag (as source or target) */
  alias_count: number
  /** Number of parent rules where this tag is a child */
  parent_count: number
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

    const paginated = this.models.Tag.select_paginated({
      sort_by: parsed.sort_by,
      order: parsed.order,
      limit: parsed.limit,
      cursor: parsed.cursor,
      tag_match: parsed.query.tag_match,
      contextual_query: contextual_query,
    })

    const results: TagSearchResultItem[] = paginated.results.map(tag => {
      const aliases_as_target = this.models.TagAlias.select_all_by_target({ target_tag_slug: tag.slug })
      const alias_as_source = this.models.TagAlias.select_by_source({ source_tag_slug: tag.slug })
      const parents = this.models.TagParent.select_parents({ source_tag_slug: tag.slug })
      return {
        ...tag,
        alias_count: aliases_as_target.length + (alias_as_source ? 1 : 0),
        parent_count: parents.length,
      }
    })

    return {
      ...paginated,
      results,
    }
  }

  /**
   * Get a single tag by slug with its full relationship graph (aliases, parents, children).
   */
  get = (params: inputs.TagGet): TagDetail => {
    const parsed = parsers.TagGet.parse(params)
    const tag = this.models.Tag.select_one({ slug: parsed.slug }, { or_raise: true })

    return this.#build_tag_detail(tag)
  }

  /**
   * Update a tag's name, group, and/or description. If name or group changes, the slug is
   * recomputed and any tag_alias/tag_parent rows referencing the old slug are updated.
   * Throws if any tag rules reference this tag and name/group is being changed.
   */
  update = (params: inputs.TagUpdate): void => {
    const parsed = parsers.TagUpdate.parse(params)
    const tag = this.models.Tag.select_one({ slug: parsed.slug }, { or_raise: true })

    const new_name = parsed.name ?? tag.name
    const new_group = parsed.group ?? tag.group
    const new_slug = tag_slug_format({ name: new_name, group: new_group })

    if (new_slug !== tag.slug) {
      const existing = this.models.Tag.select_one({ slug: new_slug })
      if (existing) {
        throw new errors.BadInputError(`Tag with slug '${new_slug}' already exists (id: ${existing.id})`)
      }

      const has_alias_as_source = this.models.TagAlias.select_by_source({ source_tag_slug: tag.slug })
      const has_alias_as_target = this.models.TagAlias.select_all_by_target({ target_tag_slug: tag.slug })
      const has_parent_as_source = this.models.TagParent.select_parents({ source_tag_slug: tag.slug })
      const has_parent_as_target = this.models.TagParent.select_children({ target_tag_slug: tag.slug })
      if (has_alias_as_source || has_alias_as_target.length || has_parent_as_source.length || has_parent_as_target.length) {
        throw new errors.BadInputError(`Cannot rename tag '${tag.slug}' because it has existing tag rules. Remove the rules first.`)
      }
    }

    let new_tag_group_id: number | undefined
    if (parsed.group !== undefined && parsed.group !== tag.group) {
      const color = get_hash_color(parsed.group, 'hsl')
      const tag_group = this.models.TagGroup.get_or_create({ name: parsed.group, color })!
      new_tag_group_id = tag_group.id
    }

    this.models.Tag.update({
      id: tag.id,
      name: new_name,
      tag_group_id: new_tag_group_id ?? tag.tag_group_id,
      slug: new_slug,
      description: parsed.description ?? tag.description,
    })
  }

  /**
   * Create an alias relationship. The source tag becomes an alias for the target (canonical) tag.
   * Any existing media_reference_tag rows on the source are migrated to the target.
   */
  alias_create = (params: inputs.TagAliasCreate): TagAliasResponse => {
    const parsed = parsers.TagAliasCreate.parse(params)
    const source_slug = tag_slug_format(parsed.source_tag)
    const target_slug = tag_slug_format(parsed.target_tag)

    if (source_slug === target_slug) {
      throw new errors.BadInputError(`A tag cannot be an alias of itself`)
    }

    const existing_alias = this.models.TagAlias.select_by_source({ source_tag_slug: source_slug })
    if (existing_alias) {
      throw new errors.BadInputError(`Tag '${source_slug}' is already an alias of '${existing_alias.target_tag_slug}'`)
    }

    const target_is_alias = this.models.TagAlias.select_by_source({ source_tag_slug: target_slug })
    if (target_is_alias) {
      throw new errors.BadInputError(`Tag '${target_slug}' is itself an alias of '${target_is_alias.target_tag_slug}' and cannot be a canonical tag`)
    }

    const transaction = this.ctx.db.transaction_sync(() => {
      const { id } = this.models.TagAlias.create({
        source_tag_slug: source_slug,
        target_tag_slug: target_slug,
      })

      this.#apply_alias_to_existing_media(source_slug, target_slug)

      return id
    })

    const rule_id = transaction()
    const rule = this.models.TagAlias.select_one({ id: rule_id }, { or_raise: true })
    const source_tag = this.models.Tag.select_one({ slug: source_slug })
    const target_tag = this.models.Tag.select_one({ slug: target_slug }, { or_raise: true })

    return {
      alias: source_tag ? this.#build_tag_detail(source_tag) : null,
      alias_for: this.#build_tag_detail(target_tag),
      rule,
    }
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
   * when the target tag (parent) is applied. Adds the parent tag to all media references
   * that currently have the child tag.
   */
  parent_create = (params: inputs.TagParentCreate): TagParentResponse => {
    const parsed = parsers.TagParentCreate.parse(params)
    const source_slug = tag_slug_format(parsed.source_tag)
    const target_slug = tag_slug_format(parsed.target_tag)

    if (source_slug === target_slug) {
      throw new errors.BadInputError(`A tag cannot be its own parent`)
    }

    this.#check_circular_parents(source_slug, target_slug)

    const transaction = this.ctx.db.transaction_sync(() => {
      const { id } = this.models.TagParent.create({
        source_tag_slug: source_slug,
        target_tag_slug: target_slug,
      })

      this.#apply_parent_to_existing_media(source_slug, target_slug)

      return id
    })

    const rule_id = transaction()
    const rule = this.models.TagParent.select_one({ id: rule_id }, { or_raise: true })
    const source_tag = this.models.Tag.select_one({ slug: source_slug })
    const target_tag = this.models.Tag.select_one({ slug: target_slug }, { or_raise: true })

    return {
      child: source_tag ? this.#build_tag_detail(source_tag) : null,
      parent: this.#build_tag_detail(target_tag),
      rule,
    }
  }

  /**
   * Delete a parent/child relationship by ID.
   */
  parent_delete = (params: inputs.TagParentDelete): void => {
    const parsed = parsers.TagParentDelete.parse(params)
    this.models.TagParent.select_one({ id: parsed.id }, { or_raise: true })
    this.models.TagParent.delete({ id: parsed.id }, { expected_deletes: 1 })
  }

  /** Build a TagDetail response for a given tag record. */
  #build_tag_detail(tag: result_types.Tag): TagDetail {
    const alias_for_row = this.models.TagAlias.select_by_source({ source_tag_slug: tag.slug })
    const alias_rows = this.models.TagAlias.select_all_by_target({ target_tag_slug: tag.slug })
    const child_rows = this.models.TagParent.select_children({ target_tag_slug: tag.slug })
    const parent_rows = this.models.TagParent.select_parents({ source_tag_slug: tag.slug })

    const resolve_with_rule = (slug: string, rule_id: number): TagWithRuleId | undefined => {
      const resolved = this.models.Tag.select_one({ slug })
      if (!resolved) return undefined
      return { ...resolved, rule_id }
    }

    return {
      tag,
      alias_for: alias_for_row ? (resolve_with_rule(alias_for_row.target_tag_slug, alias_for_row.id) ?? null) : null,
      aliases: alias_rows.map(row => resolve_with_rule(row.source_tag_slug, row.id)).filter((t): t is TagWithRuleId => t !== undefined),
      children: child_rows.map(row => resolve_with_rule(row.source_tag_slug, row.id)).filter((t): t is TagWithRuleId => t !== undefined),
      parents: parent_rows.map(row => resolve_with_rule(row.target_tag_slug, row.id)).filter((t): t is TagWithRuleId => t !== undefined),
    }
  }

  /**
   * Migrate media_reference_tag rows from the source (alias) tag to the target (canonical) tag.
   * Uses delete + get_or_create to properly trigger count updates.
   */
  #apply_alias_to_existing_media(source_slug: string, target_slug: string) {
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

  /**
   * When a parent rule is created, add the parent tag to all media references
   * that currently have the child (source) tag.
   */
  #apply_parent_to_existing_media(child_slug: string, parent_slug: string) {
    const child_tag = this.models.Tag.select_one({ slug: child_slug })
    if (!child_tag || child_tag.media_reference_count === 0) return

    const parent_tag = this.models.Tag.select_one({ slug: parent_slug })
    if (!parent_tag) return

    const child_rows = this.models.MediaReferenceTag.select_all_by_tag_id({ tag_id: child_tag.id })
    for (const row of child_rows) {
      this.models.MediaReferenceTag.get_or_create({
        media_reference_id: row.media_reference_id,
        tag_id: parent_tag.id,
        tag_group_id: parent_tag.tag_group_id,
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
