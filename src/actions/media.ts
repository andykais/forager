import { Action } from './base.ts'
import * as inputs from '../inputs/mod.ts'
import { File } from '../io/file.ts'
import { type MediaInfo } from '../inputs/mod.ts'
import { DuplicateMediaError, NotFoundError } from '../errors.ts'

class MediaAction extends Action {
  create = async (filepath: string, media_info: MediaInfo, tags: inputs.Tag[]) => {
    const params = {
      filepath: inputs.MediaFilepathInput.parse(filepath),
      media_info: inputs.MediaReferenceUpdateInput.parse(media_info),
      tags: inputs.TagListInput.parse(tags),
    }
    const file = new File(filepath)
    const { sha512checksum, size_bytes } = await file.checksum()

    if (this.db.media_reference.select_one_by_checksum({ sha512checksum })) {
      // an non-transactional step to exit early if we find the hash existing.
      // this just is a way to skip the video preview early
      throw new DuplicateMediaError(filepath, sha512checksum)
    }

    const media_file_info = await file.ffprobe()
    const thumbnail = await file.create_thumbnail(media_file_info)

    const media_reference_data = { media_sequence_index: 0, stars: 0, view_count: 0, ...params.media_info }
    const media_file_data = {
      ...media_file_info,
      file_size_bytes: size_bytes,
      sha512checksum,
    }

    const transaction = this.db.driver.transaction_async(async () => {
      const media_reference_id = this.db.media_reference.insert(media_reference_data)
      console.log({ media_reference_id })
      throw new Error('unimplemented')
    })

    try {
      return await transaction()
    } catch(e) {
      // TODO this can be handled more robustly if we do a full buffer comparison upon getting a DuplicateMediaError
      // a larger checksum would also be helpful
      // possibly we would put expensive buffer comparisons behind a config flag, opting to just use the duplicate_log otherwise
      if (this.db.is_unique_constaint_error(e)) throw new DuplicateMediaError(filepath, sha512checksum, { cause: e })
      else throw e
    }
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
