import { Action } from './base.ts'
import * as inputs from '../inputs/mod.ts'
import { type MediaInfo } from '../inputs/mod.ts'
import { NotFoundError } from '../errors.ts'

class MediaAction extends Action {
  create = async (filepath: string, media_info: MediaInfo, tags: inputs.Tag[]) => {
  }

  search = (params: inputs.PaginatedSearch = {}) => {
    const { limit, cursor, query } = inputs.PaginatedSearchInput.parse(params)
    const tag_ids: number[] = []
    if (query.tags) {
      for (const tag of query.tags) {
        const query_data = inputs.TagInput.parse(tag)
        const tag_row = this.db.tag.select_one_by_name(query_data)
        if (!tag_row) throw new NotFoundError('Tag', `${query_data.group}:${query_data.name}`)
        tag_ids.push(tag_row.id)
      }
    }
    if (query.tag_ids) {
      tag_ids.push(...query.tag_ids)
    }
    const { stars, stars_equality, unread, sort_by, order } = query

    return this.db.media_reference.select_many({ tag_ids, stars, stars_equality, unread, sort_by, order, limit, cursor })
  }
}

export { MediaAction }
