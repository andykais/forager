import { Actions, type MediaSeriesResponse, type SeriesSearchResponse, type UpdateEditor } from '~/actions/lib/base.ts'
import { inputs, outputs, parsers } from '~/inputs/mod.ts'
import type * as result_types from '~/models/lib/result_types.ts'
import * as errors from '~/lib/errors.ts'
import * as torm from '@torm/sqlite'


/**
  * Actions associated with media series.
  */
class SeriesActions extends Actions {
  public create = (media_info?: inputs.MediaSeriesInfo, tags?: inputs.Tag[]): MediaSeriesResponse => {
    const parsed = {
      media_info: parsers.MediaSeriesInfo.parse(media_info ?? {}),
      tags: parsers.TagList.parse(tags ?? [])
    }

    if (parsed.media_info.media_series_name) {
      try {
        const existing_media_series = this.models.MediaReference.select_one_media_series({media_series_name: parsed.media_info.media_series_name})
        throw new errors.SeriesAlreadyExistsError(parsed.media_info.media_series_name!, existing_media_series.id)
      } catch (e) {
        if (e instanceof errors.NotFoundError) {
          /** noop */
        } else {
          throw e
        }
      }
    }


    const transaction = this.ctx.db.transaction_sync(() => {
      const media_reference = this.models.MediaReference.create({
        media_series_reference: true,
        stars: 0,
        view_count: 0,
        ...media_info 
      })!

      const tags: ReturnType<typeof this.models.Tag.select_one>[] = []

      for (const tag of parsed.tags) {
        const group = tag.group ?? ''
        // const color = get_hash_color(group, 'hsl')
        const color = ''
        const tag_group = this.models.TagGroup.get_or_create({ name: group, color })!
        const {id: tag_id} = this.models.Tag.get_or_create({ alias_tag_id: null, name: tag.name, tag_group_id: tag_group.id, description: tag.description, metadata: tag.metadata })
        this.models.MediaReferenceTag.create({ media_reference_id: media_reference.id, tag_id, tag_group_id: tag_group.id })

        const tag_record = this.models.Tag.select_one({id: tag_id}, {or_raise: true})
        tags.push(tag_record)
      }
      return { media_reference, tags }
    })

    const transaction_result = transaction()
    // no thumbnails should exist yet, so we give it limit: 0
    return this.#get_media_series_response({series_id: transaction_result.media_reference.id })
  }

  public update = (series_id: number, media_info?: inputs.MediaInfo, tags?: inputs.Tag[], editing?: UpdateEditor): MediaSeriesResponse => {
    const parsed = {
      series_id: parsers.MediaReferenceId.parse(series_id),
      media_info: parsers.MediaReferenceUpdate.parse(media_info ?? {}),
      tags: parsers.TagList.parse(tags ?? [])
    }

    if (editing) {
      throw new Error(`unimplemented`)
    }

    // ensure this is a series reference first
    this.models.MediaReference.select_one_media_series({id: series_id})

    const transaction = this.ctx.db.transaction_sync(() => {
      this.models.MediaReference.update({
        id: parsed.series_id,
        ...parsed.media_info,
      })
      for (const tag of parsed.tags) {
        const group = tag.group ?? ''
        // const color = get_hash_color(group, 'hsl')
        const color = ''
        const tag_group = this.models.TagGroup.get_or_create({ name: group, color })!
        const tag_record = this.models.Tag.get_or_create({ alias_tag_id: null, name: tag.name, tag_group_id: tag_group.id, description: tag.description, metadata: tag.metadata })
        this.models.MediaReferenceTag.get_or_create({ media_reference_id: parsed.series_id, tag_id: tag_record.id, tag_group_id: tag_record.tag_group_id })
      }
    })

    transaction()
    return this.#get_media_series_response({series_id: parsed.series_id})
  }

  public add = (params: inputs.SeriesItem) => {
    const parsed = parsers.SeriesItem.parse(params)

    // ensure this is a series reference first
    this.models.MediaReference.select_one_media_series({id: parsed.series_id})

    // making it default to the back of the list is more complicated (either storing that data on MediaReference or doing MAX() sql call) so for now we just default to putting it on the front of the list
    const series_index = parsed.series_index ?? 0

    try {
      const series_item = this.models.MediaSeriesItem.create({
        series_id: parsed.series_id,
        media_reference_id: parsed.media_reference_id,
        series_index: series_index,
      })!
      const series_item_tags = this.models.Tag.select_all({media_reference_id: parsed.media_reference_id }).map(tag => ({
        slug: this.models.Tag.format_slug(tag),
        group: tag.group,
        name: tag.name,
      }))
      // merge the series item tags into the series reference
      this.manage_media_tags(parsed.series_id, {add: series_item_tags, remove: []})
      return this.models.MediaSeriesItem.select_one({id: series_item.id})
    } catch (e) {
      if (e instanceof torm.errors.UniqueConstraintError) {
        const series = this.models.MediaReference.select_one_media_series({id: parsed.series_id})
        throw new errors.SeriesItemAlreadyExistsError(series.media_series_name!, parsed.series_index!, parsed.media_reference_id)
      } else {
        throw e
      }
    }

  }

  public get = (params: inputs.SeriesGet): MediaSeriesResponse => {
    const parsed = parsers.SeriesGet.parse(params)
    return this.#get_media_series_response(parsed)
  }

  public search = (params: inputs.SeriesSearch): result_types.PaginatedResult<SeriesSearchResponse> => {
    const parsed = parsers.SeriesSearch.parse(params)
    const { query } = parsed

    // Ensure the series exists and is valid
    this.models.MediaReference.select_one_media_series({id: query.series_id})

    const tag_ids: number[] | undefined = query.tags
      ?.map(tag => this.models.Tag.select_one({name: tag.name, group: tag.group }, {or_raise: true}).id)
      .filter((tag): tag is number => tag !== undefined)

    let keypoint_tag_id: number | undefined
    if (query.keypoint) {
      keypoint_tag_id = this.models.Tag.select_one({name: query.keypoint.name, group: query.keypoint.group}, {or_raise: true}).id
    }

    const records = this.models.MediaReference.select_many_series({
      series_id: query.series_id,
      tag_ids,
      keypoint_tag_id,
      cursor: parsed.cursor,
      limit: parsed.limit,
      sort_by: parsed.sort_by,
      animated: query.animated,
      order: parsed.order,
      stars: query.stars,
      stars_equality: query.stars_equality,
      duration_min: query.duration?.min?.seconds,
      duration_max: query.duration?.max?.seconds,
      unread: query.unread,
      filepath: query.filepath,
    })

    const results = this.#map_series_records_to_responses(records, parsed.thumbnail_limit, keypoint_tag_id)

    return {
      total: records.total,
      cursor: records.cursor,
      results: results,
    }
  }

  #get_media_series_response(params: outputs.SeriesGet): MediaSeriesResponse {
    const media_reference = this.models.MediaReference.select_one_media_series({id: params.series_id, media_series_name: params.series_name})
    const tags = this.models.Tag.select_all({media_reference_id: media_reference.id})
    return {
      media_type: 'media_series',
      media_reference,
      tags,
      thumbnails: this.models.MediaThumbnail.select_many({series_id: media_reference.id, limit: 0}),
    }
  }

  #map_series_records_to_responses(records: ReturnType<Actions['models']['MediaReference']['select_many_series']>, thumbnail_limit: number, keypoint_tag_id: number | undefined): SeriesSearchResponse[] {
    const results: SeriesSearchResponse[] = records.results.map(row => {
      const tags = this.models.Tag.select_all({media_reference_id: row.id})

      if (row.media_series_reference) {
        const thumbnails = this.models.MediaThumbnail.select_many({series_id: row.id, limit: thumbnail_limit})
        return {
          media_type: 'media_series',
          media_reference: row,
          tags,
          thumbnails,
          series_index: row.series_index,
        }
      } else {
        const media_file = this.models.MediaFile.select_one({media_reference_id: row.id}, {or_raise: true})

        let thumbnail_timestamp_threshold: number | undefined
        if (keypoint_tag_id) {
          thumbnail_timestamp_threshold = this.models.MediaKeypoint.select_one({tag_id: keypoint_tag_id, media_reference_id: row.id}, {or_raise: true}).media_timestamp
        } else if (media_file.animated && thumbnail_limit === 1) {
          thumbnail_timestamp_threshold = media_file.duration * (this.ctx.config.thumbnails.preview_duration_threshold / 100)
        }

        const thumbnails = this.models.MediaThumbnail.select_many({media_file_id: media_file.id, limit: thumbnail_limit, timestamp_threshold: thumbnail_timestamp_threshold})
        return {
          media_type: 'media_file',
          media_reference: row,
          media_file,
          tags,
          thumbnails,
          series_index: row.series_index,
        }
      }
    })
    return results
  }
}


export { SeriesActions }
