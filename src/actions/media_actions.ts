import * as path from '@std/path'
import * as fs from '@std/fs'
import { Actions } from '~/actions/lib/base.ts'
import { inputs, parsers } from '~/inputs/mod.ts'
import * as result_types from '~/models/lib/result_types.ts'
import { FileProcessor } from '../lib/file_processor.ts'
import * as errors from '~/lib/errors.ts'
import { MediaSeriesResponse } from './series_actions.ts'

export interface MediaFileResponse {
  media_type: 'media_file'
  media_reference: result_types.MediaReference
  media_file: result_types.MediaFile
  tags: result_types.Tag[]
  thumbnails: result_types.PaginatedResult<result_types.MediaThumbnail>
}

class MediaActions extends Actions {
  #create_series_for_media_directories(params: {
    media_reference_id: number
    media_filepath: string
  }) {
    const recursive_path_parse = (path_segment: string): string[] => {
      const parsed_path = path.parse(path_segment)
      if (parsed_path.root === parsed_path.dir) {
        return [parsed_path.dir, path_segment]
      } else {
        return [...recursive_path_parse(parsed_path.dir), path_segment]
      }
    }
    const path_segments = recursive_path_parse(path.parse(params.media_filepath).dir)

    let parent_series_id: number | undefined
    for (const [index, path_segment] of path_segments.entries()) {
      const directory_root = index === 0
      const series = this.models.MediaReference.get_or_create({
        media_series_reference: true,
        directory_reference: true,
        directory_path: path_segment,
        directory_root: directory_root,
        media_sequence_index: 0,
        stars: 0,
        view_count: 0,
      })

      if (parent_series_id) {
        this.models.MediaSeriesItem.create_series({
          series_id: parent_series_id,
          media_reference_id: series.id,
        })
      }

      parent_series_id = series.id
    }

    if (parent_series_id === undefined) {
      throw new errors.UnExpectedError('Media files should always have at least one parent dir')
    }

    this.models.MediaSeriesItem.create_series({
      series_id: parent_series_id,
      media_reference_id: params.media_reference_id,
    })
  }


  create = async (filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.Tag[]): Promise<MediaFileResponse> => {
    const parsed = {
      media_info: parsers.MediaReferenceUpdate.parse(media_info ?? {}),
      tags: tags?.map(t => parsers.Tag.parse(t)) ?? [],
    }

    const file_processor = new FileProcessor(this.ctx, filepath)
    const media_file_info = await file_processor.get_info()
    const checksum = await file_processor.get_checksum()

    if (this.models.MediaFile.select_one({checksum})) {
      // an non-transactional step to exit early if we find the hash existing.
      // this just is a way to skip the video preview early
      throw new errors.DuplicateMediaError(filepath, checksum)
    }
    const [file_size, thumbnails] = await Promise.all([
      file_processor.get_size(),
      file_processor.create_thumbnails(media_file_info, checksum)
    ])

    const transaction = this.ctx.db.transaction_async(async () => {
      const media_reference = this.models.MediaReference.create({
        media_series_reference: false,
        media_sequence_index: 0,
        stars: 0,
        view_count: 0,
        ...media_info 
      })

      const media_file = this.models.MediaFile.create({
        ...media_file_info,
        file_size_bytes: file_size,
        checksum,
        media_reference_id: media_reference.id,
      })!

      for (const tag of parsed.tags) {
        const group = tag.group ?? ''
        // const color = get_hash_color(group, 'hsl')
        const color = ''
        const tag_group = this.models.TagGroup.get_or_create({ name: group, color })!
        const tag_record = this.models.Tag.get_or_create({ alias_tag_id: null, name: tag.name, tag_group_id: tag_group.id, description: tag.description, metadata: tag.metadata })
        this.models.MediaReferenceTag.create({ media_reference_id: media_reference.id, tag_id: tag_record.id })
      }

      this.#create_series_for_media_directories({
        media_reference_id: media_reference.id,
        media_filepath: media_file_info.filepath,
      })

      for (const thumbnail of thumbnails.thumbnails) {
        this.models.MediaThumbnail.create({
          media_file_id: media_file.id,
          filepath: thumbnail.destination_filepath,
          media_timestamp: thumbnail.timestamp,
        })
      }

      // copy the thumbnails into the configured folder (we wait until the database writes to do this to keep the generated thumbnail folder clean)
      // add the storage folder checksum here to merge the new files into whatever files already exist in that directory
      await fs.copy(thumbnails.source_folder, thumbnails.destination_folder)
      return { media_reference, tags }
    })

    const transaction_result = await transaction()
    return {
      media_type: 'media_file',
      media_reference: this.models.MediaReference.select_one({id: transaction_result.media_reference.id}, {or_raise: true}),
      media_file: this.models.MediaFile.select_one({media_reference_id: transaction_result.media_reference.id}, {or_raise: true}),
      tags: this.models.Tag.select_many({media_reference_id: transaction_result.media_reference.id}),
      thumbnails: this.models.MediaThumbnail.select_many({media_file_id: transaction_result.media_reference.id, limit: 1}),
    }
  }

  update = (media_reference_id: number, media_info: inputs.MediaInfo) => {
    throw new Error('unimplemented')
  /*
    const parsed = inputs.MediaReferenceUpdate.parse(media_info)
    this.db.media_reference.update(media_reference_id, parsed)
  */
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
