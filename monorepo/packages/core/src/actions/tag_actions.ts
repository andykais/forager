import { Actions } from '~/actions/lib/base.ts'
import { type inputs, parsers } from '~/inputs/mod.ts'


/**
  * Actions associated with tag management in forager
  */
class TagActions extends Actions {
  search = (params?: inputs.TagSearch) => {
    const parsed = parsers.TagSearch.parse(params ?? {})
    return this.models.Tag.select_paginated({
      limit: parsed.limit,
      cursor: parsed.cursor,
      tag_match: parsed.query.tag_match,
    })
  }
}


export { TagActions }
