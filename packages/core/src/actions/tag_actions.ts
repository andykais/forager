import { Actions } from '~/actions/lib/base.ts'
import { type inputs, parsers } from '~/inputs/mod.ts'
import { duration_to_seconds } from '~/inputs/media_reference_inputs.ts'
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
        duration_min: duration_to_seconds(parsed.contextual_query.duration?.min),
        duration_max: duration_to_seconds(parsed.contextual_query.duration?.max),
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
}


export { TagActions }
