import { Actions, type MediaFileResponse, type MediaSeriesResponse, type MediaResponse } from '~/actions/lib/base.ts'
import { type inputs, parsers } from '~/inputs/mod.ts'
import type * as result_types from '~/models/lib/result_types.ts'
import { errors } from "~/mod.ts";


class MediaActions extends Actions {

  create = async (filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.Tag[]): Promise<MediaFileResponse> => {
    return await this.media_create(filepath, media_info, tags)
  }

  update = (media_reference_id: number, media_info?: inputs.MediaInfo, tags?: inputs.Tag[]) => {
    return this.media_update(media_reference_id, media_info, tags)
  }

  upsert = async (filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.Tag[]): Promise<MediaFileResponse> => {
    try {
      return await this.media_create(filepath, media_info, tags)
    } catch (e) {
      if (e instanceof errors.MediaAlreadyExistsError) {
        const media_file = this.models.MediaFile.select_one({checksum: e.checksum}, {or_raise: true})
        return this.update(media_file.media_reference_id, media_info, tags)
      }
      throw e
    }
  }

  delete = async (params: inputs.MediaReferenceGet) => {
    const parsed = parsers.MediaReferenceGet.parse(params)
    const transaction = this.ctx.db.transaction_async(async () => {
      const result = this.media_get({...parsed, thumbnail_limit: 0})
      if (result.media_type === 'media_file') {
        this.models.MediaReferenceTag.delete({media_reference_id: result.media_reference.id}, {expected_deletes: result.tags.length})
        this.models.MediaThumbnail.delete({media_file_id: result.media_file.id}, {expected_deletes: result.thumbnails.total})
        this.models.MediaFile.delete({id: result.media_file.id}, {expected_deletes: 1})
        this.models.MediaKeypoint.delete({media_reference_id: result.media_reference.id})
        this.models.MediaSeriesItem.delete({media_reference_id: result.media_reference.id})
        this.models.MediaReference.delete({id: result.media_reference.id}, {expected_deletes: 1})
        // TODO return views in media_get and add an expected_deletes for them here
        this.models.View.delete({media_reference_id: result.media_reference.id})
        await Deno.remove(result.media_file.thumbnail_directory_path, {recursive: true})
        this.ctx.logger.info(`Removed ${result.media_file.filepath} media with media reference id ${result.media_reference.id}`)
      } else {
        throw new Error('unimplemented')
      }
    })

    try {
      await transaction()
    } catch (e) {
      this.ctx.logger.error(`Error "${e.name}" during media delete for ${JSON.stringify(params)}, delete aborted.`)
      throw e
    }
  }

  search = (params?: inputs.PaginatedSearch): result_types.PaginatedResult<MediaResponse> => {
    const parsed = parsers.PaginatedSearch.parse(params ?? {})
    const { query } = parsed

    const tag_ids: number[] | undefined = query.tags
      ?.map(tag => this.models.Tag.select_one({name: tag.name, group: tag.group }, {or_raise: true}).id)
      .filter((tag): tag is number => tag !== undefined)

    let keypoint_tag_id: number | undefined
    if (query.keypoint) {
      keypoint_tag_id = this.models.Tag.select_one({name: query.keypoint.name, group: query.keypoint.group}, {or_raise: true}).id
    }

    let series_id: number | undefined
    if (query.series_id) {
      // ensure that a series id actually exists and is a series id
      this.models.MediaReference.media_series_select_one({id: query.series_id})
      series_id = query.series_id
    }

    if (query.directory) {
      const directory_reference = this.models.MediaReference.media_series_select_one({directory_path: query.directory})
      series_id = directory_reference.id
    }

    const records = this.models.MediaReference.select_many({
      id: query.media_reference_id,
      series_id,
      tag_ids,
      keypoint_tag_id,
      cursor: parsed.cursor,
      limit: parsed.limit,
      sort_by: parsed.sort_by,
      order: parsed.order,
      stars: query.stars,
      stars_equality: query.stars_equality,
      unread: query.unread,
      filesystem: query.filesystem,
    })

    const results: (MediaFileResponse | MediaSeriesResponse)[] =  records.results.map(row => {
      const tags = this.models.Tag.select_all({media_reference_id: row.id})

      if (row.media_series_reference) {
        const thumbnails = this.models.MediaThumbnail.select_many({series_id: row.id, limit: parsed.thumbnail_limit})
        return {
          media_type: 'media_series',
          media_reference: row,
          tags,
          thumbnails,
        }
      } else {
        let media_keypoint: result_types.MediaKeypoint | undefined
        if (keypoint_tag_id) {
          media_keypoint = this.models.MediaKeypoint.select_one({tag_id: keypoint_tag_id, media_reference_id: row.id}, {or_raise: true})
        }
        const media_file = this.models.MediaFile.select_one({media_reference_id: row.id})
        if (media_file === undefined) throw new Error(`reference error: MediaReference id ${row.id} has no media_file`)
        const thumbnails = this.models.MediaThumbnail.select_many({media_file_id: media_file.id, limit: parsed.thumbnail_limit, keypoint_timestamp: media_keypoint?.media_timestamp})
        return {
          media_type: 'media_file',
          media_reference: row,
          media_file,
          tags,
          thumbnails,
        }
      }
    })

    return {
      total: records.total,
      cursor: records.cursor,
      results: results,
    }
  }

  // TODO different params for group by ({group_by: {tag_group: string}, sort_by: 'count'})
  group = (params: inputs.PaginatedSearchGroupBy) => {
    const parsed = parsers.PaginatedSearchGroupBy.parse(params ?? {})
    const { query } = parsed

    const tag_ids: number[] | undefined = query.tags
      ?.map(tag => this.models.Tag.select_one({name: tag.name, group: tag.group }, {or_raise: true}).id)
      .filter((tag): tag is number => tag !== undefined)

    let keypoint_tag_id: number | undefined
    if (query.keypoint) {
      keypoint_tag_id = this.models.Tag.select_one({name: query.keypoint.name, group: query.keypoint.group}, {or_raise: true}).id
    }

    let series_id: number | undefined
    if (query.series_id) {
      // ensure that a series id actually exists and is a series id
      this.models.MediaReference.media_series_select_one({id: query.series_id})
      series_id = query.series_id
    }

    if (query.directory) {
      const directory_reference = this.models.MediaReference.media_series_select_one({directory_path: query.directory})
      series_id = directory_reference.id
    }

    const tag_group = this.models.TagGroup.select_one({name: parsed.group_by.tag_group}, {or_raise: true})
    const group_by = { tag_group_id: tag_group.id }
    const records = this.models.MediaReference.select_many_group_by_tags({
      id: query.media_reference_id,
      series_id,
      tag_ids,
      keypoint_tag_id,
      cursor: parsed.cursor,
      limit: parsed.limit,
      sort_by: parsed.sort_by,
      group_by,
      order: parsed.order,
      stars: query.stars,
      stars_equality: query.stars_equality,
      unread: query.unread,
      filesystem: query.filesystem,
    })

    const results = records.results.map(record => {

      return {
        media_type: 'grouped',
        group: {
          value: record.group_value,
          count: record.count_value,
        },
      }
    })

    return {
      total: records.total,
      cursor: records.cursor,
      results,
    }
  }

  get = (params: inputs.MediaReferenceGet) => {
    const parsed = parsers.MediaReferenceGet.parse(params)
    return this.media_get({
      media_reference_id: parsed.media_reference_id,
      filepath: parsed.filepath,
      thumbnail_limit: -1,
    })
  }
}


export { MediaActions }
