import { Actions } from '~/actions/lib/base.ts'
import { type inputs, parsers } from '~/inputs/mod.ts'
import type * as result_types from '~/models/lib/result_types.ts'
import { FileProcessor } from '~/lib/file_processor.ts'
import * as errors from '~/lib/errors.ts'
import { TagSearch } from "~/inputs/tag_inputs.ts"


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
