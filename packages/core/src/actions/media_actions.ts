import { Actions, type MediaFileResponse, type MediaSeriesResponse } from '~/actions/lib/base.ts'
import { inputs, parsers } from '~/inputs/mod.ts'
import * as result_types from '~/models/lib/result_types.ts'
import { errors } from "~/mod.ts";

class MediaActions extends Actions {

  create = async (filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.Tag[]): Promise<MediaFileResponse> => {
    return await this.media_create(filepath, media_info, tags)
  }

  update = (media_reference_id: number, media_info?: inputs.MediaInfo, tags?: inputs.Tag[]) => {
    const parsed = {
      media_reference_id: parsers.MediaReferenceId.parse(media_reference_id),
      media_info: parsers.MediaInfo.parse(media_info ?? {}),
      tags: parsers.TagList.parse(tags ?? []),
    }

    const transaction = this.ctx.db.transaction_sync(() => {
      this.models.MediaReference.update({
        id: media_reference_id,
        ...parsed.media_info,
      })
      for (const tag of parsed.tags) {
        const group = tag.group ?? ''
        // const color = get_hash_color(group, 'hsl')
        const color = ''
        const tag_group = this.models.TagGroup.get_or_create({ name: group, color })!
        const tag_record = this.models.Tag.get_or_create({ alias_tag_id: null, name: tag.name, tag_group_id: tag_group.id, description: tag.description, metadata: tag.metadata })
        this.models.MediaReferenceTag.get_or_create({ media_reference_id: parsed.media_reference_id, tag_id: tag_record.id })
      }
    })

    transaction()

    // TODO this will currently error when we pass in a series media reference. We need to handle that
    const media_file = this.models.MediaFile.select_one({media_reference_id}, {or_raise: true})
    return this.get_media_file_result({
      media_reference_id,
      media_file_id: media_file.id,
      thumbnail_limit: 1,
    })
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

  search = (params?: inputs.PaginatedSearch): result_types.PaginatedResult<MediaFileResponse | MediaSeriesResponse> => {
    const parsed = {
      params: parsers.PaginatedSearch.parse(params ?? {}),
    }

    const tag_ids: number[] | undefined = parsed.params.query.tags
      ?.map(tag => this.models.Tag.select_one({name: tag.name, group: tag.group }, {or_raise: true}).id)
      .filter((tag): tag is number => tag !== undefined)

    let series_id: number | undefined
    if (parsed.params.query.series_id) {
      // ensure that a series id actually exists and is a series id
      this.models.MediaReference.media_series_select_one({id: parsed.params.query.series_id})
      series_id = parsed.params.query.series_id
    }

    if (parsed.params.query.directory) {
      const directory_reference = this.models.MediaReference.media_series_select_one({directory_path: parsed.params.query.directory})
      series_id = directory_reference.id
    }

    const records = this.models.MediaReference.select_many({
      id: parsed.params.query.media_reference_id,
      series_id,
      tag_ids,
      cursor: parsed.params.cursor,
      limit: parsed.params.limit,
      sort_by: parsed.params.sort_by,
      order: parsed.params.order,
      stars: parsed.params.query.stars,
      stars_equality: parsed.params.query.stars_equality,
      unread: parsed.params.query.unread,
      filesystem: parsed.params.query.filesystem,
    })

    const results: (MediaFileResponse | MediaSeriesResponse)[] =  records.result.map(row => {
      const tags = this.models.Tag.select_many({media_reference_id: row.id})

      if (row.media_series_reference) {
        const thumbnails = this.models.MediaThumbnail.select_many({series_id: row.id, limit: parsed.params.thumbnail_limit})
        return {
          media_type: 'media_series',
          media_reference: row,
          tags,
          thumbnails,
        }
      } else {
        const media_file = this.models.MediaFile.select_one({media_reference_id: row.id})
        if (media_file === undefined) throw new Error(`reference error: MediaReference id ${row.id} has no media_file`)
        const thumbnails = this.models.MediaThumbnail.select_many({media_file_id: media_file.id, limit: parsed.params.thumbnail_limit})
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
      result: results,
    }
  }

  search_group_by = () => {
    throw new Error('unimplemented')
  /*
    return {
      total: 2,
      cursor: '',
      results: [
        {
          group: '',
          count: 10
        },
        {
          group: 'medium',
          count: 3
        }
      ]
    }
  */
  }

  get = (params: {media_reference_id: number}) => {
    throw new Error('unimplemented')
  /*
    const media_file = this.db.media_file.select_one({ media_reference_id })
    // TODO these should be a get_or_raise helper or something
    if (!media_file) throw new NotFoundError('MediaFile', {media_reference_id})
    const media_reference = this.db.media_reference.select_one({ media_reference_id })
    if (!media_reference) throw new Error(`media_file does not exist for media_refernce_id ${media_reference_id}`)
    const tags = this.db.tag.select_many_by_media_reference({ media_reference_id })

    return { media_file, media_reference, tags }
  */
  }
}


export { MediaActions }
