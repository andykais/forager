import { Actions } from '~/actions/lib/base.ts'
import { type inputs, parsers } from '~/inputs/mod.ts'
import type { SelectManyFilters } from '~/models/media_reference.ts'


/**
  * Actions associated with tag management in forager
  */
class TagActions extends Actions {
  search = (params?: inputs.TagSearch) => {
    const parsed = parsers.TagSearch.parse(params ?? {})

    let contextual_query: undefined | SelectManyFilters
    if (parsed?.contextual_query && Object.keys(parsed.contextual_query).length) {
      const tag_ids: number[] | undefined = parsed.contextual_query.tags
        ?.map(tag => this.models.Tag.select_one({name: tag.name, group: tag.group }, {or_raise: true}).id)
        .filter((tag): tag is number => tag !== undefined)

      contextual_query = {
        animated: undefined,
        cursor: undefined,
        filepath: undefined,
        id: undefined,
        keypoint_tag_id: undefined,
        limit: undefined,
        order: undefined,
        series: undefined,
        series_id: undefined,
        sort_by: 'created_at',
        stars: undefined,
        duration_min: undefined,
        duration_max: undefined,
        unread: undefined,
        ...parsed.contextual_query,
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
}


export { TagActions }
