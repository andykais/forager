import * as fs from '@std/fs'
import * as fmt_bytes from '@std/fmt/bytes'
import { Actions, type MediaFileResponse, type MediaSeriesResponse, type MediaResponse, type MediaGroupResponse, type CreateEditor, type UpdateEditor } from '~/actions/lib/base.ts'
import { type inputs, parsers } from '~/inputs/mod.ts'
import type * as result_types from '~/models/lib/result_types.ts'
import { errors } from "~/mod.ts";
import { FileProcessor } from '~/lib/file_processor.ts'


/**
  * Actions associated with media references.
  */
class MediaActions extends Actions {

  create = async (filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.Tag[], editing?: CreateEditor): Promise<MediaFileResponse> => {
    return await this.media_create(filepath, media_info, tags, editing)
  }

  update = (media_reference_id: number, media_info?: inputs.MediaInfo, tags?: inputs.MediaReferenceUpdateTags, editing?: UpdateEditor) => {
    return this.media_update(media_reference_id, media_info, tags, editing)
  }

  upsert = async (filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.MediaReferenceUpdateTags): Promise<MediaFileResponse> => {
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
      this.ctx.logger.error(`Error "${e}" during media delete for ${JSON.stringify(params)}, delete aborted.`)
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
      this.models.MediaReference.select_one_media_series({id: query.series_id})
      series_id = query.series_id
    }

    const records = this.models.MediaReference.select_many({
      id: query.media_reference_id,
      series: query.series,
      series_id,
      tag_ids,
      keypoint_tag_id,
      cursor: parsed.cursor,
      limit: parsed.limit,
      sort_by: parsed.sort_by,
      animated: parsed.query.animated,
      order: parsed.order,
      stars: query.stars,
      stars_equality: query.stars_equality,
      duration_min: query.duration?.min?.seconds,
      duration_max: query.duration?.max?.seconds,
      unread: query.unread,
      filepath: query.filepath,
    })

    const results = this.#map_media_records_to_media_responses(records, parsed.thumbnail_limit, keypoint_tag_id)

    return {
      total: records.total,
      cursor: records.cursor,
      results: results,
    }
  }

  #map_media_records_to_media_responses(records: ReturnType<Actions['models']['MediaReference']['select_many']>, thumbnail_limit: number, keypoint_tag_id: number | undefined): MediaResponse[] {
    const results: (MediaFileResponse | MediaSeriesResponse)[] =  records.results.map(row => {
      const tags = this.models.Tag.select_all({media_reference_id: row.id})

      if (row.media_series_reference) {
        const thumbnails = this.models.MediaThumbnail.select_many({series_id: row.id, limit: thumbnail_limit})
        return {
          media_type: 'media_series',
          media_reference: row,
          tags,
          thumbnails,
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
        }
      }
    })
    return results
  }

  group = (params: inputs.PaginatedSearchGroupBy): result_types.PaginatedResult<MediaGroupResponse> => {
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
      this.models.MediaReference.select_one_media_series({id: query.series_id})
      series_id = query.series_id
    }

    const tag_group = this.models.TagGroup.select_one({name: parsed.group_by.tag_group}, {or_raise: true})
    const group_by = { tag_group_id: tag_group.id }
    const records = this.models.MediaReference.select_many_group_by_tags({
      id: query.media_reference_id,
      series_id,
      series: query.series,
      tag_ids,
      keypoint_tag_id,
      cursor: parsed.cursor,
      limit: parsed.limit,
      sort_by: parsed.sort_by,
      animated: parsed.query.animated,
      group_by,
      order: parsed.order,
      stars: query.stars,
      stars_equality: query.stars_equality,
      duration_min: query.duration?.min?.seconds,
      duration_max: query.duration?.max?.seconds,
      unread: query.unread,
      filepath: query.filepath,
    })

    const results = records.results.map(record => {
      const merged_tag_ids: number[] = []
      const grouped_tag_id = this.models.Tag.select_one({name: record.group_value, group: parsed.group_by.tag_group}, {or_raise: true}).id
      if (tag_ids) {
        merged_tag_ids.push(...tag_ids)
      }
      merged_tag_ids.push(grouped_tag_id)

      let media: MediaResponse[] | undefined
      if (parsed.grouped_media.limit) {
        const records = this.models.MediaReference.select_many({
          id: query.media_reference_id,
          series: query.series,
          series_id,
          tag_ids: merged_tag_ids,
          keypoint_tag_id,
          cursor: undefined,
          limit: parsed.grouped_media.limit,
          sort_by: parsed.grouped_media.sort_by,
          animated: parsed.query.animated,
          order: parsed.grouped_media.order,
          stars: query.stars,
          stars_equality: query.stars_equality,
          duration_min: query.duration?.min?.seconds,
          duration_max: query.duration?.max?.seconds,
          unread: query.unread,
          filepath: query.filepath,
        })
        media = this.#map_media_records_to_media_responses(records, parsed.thumbnail_limit, keypoint_tag_id)
      }

      const { group_value, count_value, ...fields } = record
      return {
        media_type: 'grouped' as const,
        group: {
          value: group_value,
          count: count_value,
          ...fields,
          media,
        },
      }
    })

    return {
      total: records.total,
      cursor: records.cursor,
      results,
    }
  }

  /**
    * Get a single media reference by id or filepath
    */
  get = (params: inputs.MediaReferenceGet): MediaResponse => {
    const parsed = parsers.MediaReferenceGet.parse(params)
    return this.media_get({
      media_reference_id: parsed.media_reference_id,
      filepath: parsed.filepath,
      thumbnail_limit: -1,
    })
  }

  thumbnail = (params: inputs.MediaThumbnailGet): result_types.MediaThumbnail => {
    const parsed = parsers.MediaThumbnailGet.parse(params)
    const thumbnail = this.models.MediaThumbnail.select_one({
      thumbnail_id: parsed.thumbnail_id
    }, { or_raise: true })

    return thumbnail
  }

  /**
   * Re-parse media files and regenerate thumbnails for media matching the given search query.
   * If a file's checksum has changed since it was originally ingested, an error is thrown.
   * Media series in the search results are skipped with a warning log.
   */
  reload = async (params?: inputs.PaginatedSearch): Promise<MediaFileResponse[]> => {
    const search_results = this.search(params)
    const reloaded: MediaFileResponse[] = []

    for (const result of search_results.results) {
      if (result.media_type === 'media_series') {
        this.ctx.logger.warn(`Skipping media series '${result.media_reference.media_series_name}' (id: ${result.media_reference.id}) during reload`)
        continue
      }

      const { media_file, media_reference } = result
      const file_processor = new FileProcessor(this.ctx, media_file.filepath)
      const [media_file_info, checksum, file_size] = await Promise.all([
        file_processor.get_info(),
        file_processor.get_checksum(),
        file_processor.get_size(),
      ])

      if (checksum !== media_file.checksum) {
        throw new errors.ChecksumMismatchError(media_file.filepath, media_file.checksum, checksum)
      }

      const thumbnails = await file_processor.create_thumbnails(media_file_info, checksum)

      const transaction = this.ctx.db.transaction_async(async () => {
        // delete old thumbnail records
        this.models.MediaThumbnail.delete({media_file_id: media_file.id})

        // update media file metadata
        this.models.MediaFile.update({
          id: media_file.id,
          thumbnail_directory_path: thumbnails.destination_folder,
          file_size_bytes: file_size,
          media_type: media_file_info.media_type,
          content_type: media_file_info.content_type,
          codec: media_file_info.codec,
          width: media_file_info.width,
          height: media_file_info.height,
          animated: media_file_info.animated,
          audio: media_file_info.audio,
          duration: media_file_info.duration,
          framerate: media_file_info.framerate,
          framecount: media_file_info.framecount,
        })

        // create new thumbnail records
        for (const thumbnail of thumbnails.thumbnails) {
          this.models.MediaThumbnail.create({
            media_file_id: media_file.id,
            filepath: thumbnail.destination_filepath,
            kind: 'standard',
            media_timestamp: thumbnail.timestamp,
          })
        }

        // remove old thumbnail directory and copy new thumbnails
        try {
          await Deno.remove(media_file.thumbnail_directory_path, {recursive: true})
        } catch (e) {
          if (!(e instanceof Deno.errors.NotFound)) {
            throw e
          }
        }
        await fs.copy(thumbnails.source_folder, thumbnails.destination_folder)
        await Deno.remove(thumbnails.source_folder, {recursive: true})
      })

      await transaction()

      const output_result = this.get_media_file_result({
        media_reference_id: media_reference.id,
        media_file_id: media_file.id,
        thumbnail_limit: 1,
      })
      this.ctx.logger.info(`Reloaded ${media_file.filepath} (type: ${output_result.media_file.media_type} size: ${fmt_bytes.format(output_result.media_file.file_size_bytes)})`)
      reloaded.push(output_result)
    }

    return reloaded
  }
}


export { MediaActions }
