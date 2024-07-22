import z from 'zod'
import type { Context } from '~/context.ts'
import * as fs from '@std/fs'
import * as path from '@std/path'
import * as fmt_bytes from 'jsr:@std/fmt/bytes'
import * as fmt_duration from 'jsr:@std/fmt/duration'
import { inputs, parsers } from '~/inputs/mod.ts'
import * as result_types from '~/models/lib/result_types.ts'
import { FileProcessor } from '~/lib/file_processor.ts'
import * as errors from '~/lib/errors.ts'

export interface MediaSeriesResponse {
  media_type: 'media_series'
  media_reference: result_types.MediaReference
  tags: result_types.Tag[]
  thumbnails: result_types.PaginatedResult<result_types.MediaThumbnail>
}

export interface MediaFileResponse {
  media_type: 'media_file'
  media_reference: result_types.MediaReference
  media_file: result_types.MediaFile
  tags: result_types.Tag[]
  thumbnails: result_types.PaginatedResult<result_types.MediaThumbnail>
}

class Actions {
  protected ctx: Context
  public constructor(ctx: Context) {
    this.ctx = ctx
  }

  protected get models() {
    return this.ctx.db.models
  }

  protected async media_create(filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.Tag[]): Promise<MediaFileResponse> {
    const start_time = performance.now()
    const parsed = {
      filepath: parsers.Filepath.parse(filepath),
      media_info: parsers.MediaReferenceUpdate.parse(media_info ?? {}),
      tags: tags?.map(t => parsers.Tag.parse(t)) ?? [],
    }

    const file_processor = new FileProcessor(this.ctx, filepath)
    const media_file_info = await file_processor.get_info()
    const checksum = await file_processor.get_checksum()

    const existing_media_file = this.models.MediaFile.select_one({checksum})
    if (existing_media_file) {
      if (existing_media_file.filepath === parsed.filepath) {
        throw new errors.MediaAlreadyExistsError(filepath, checksum)
      } else {
        // an non-transactional step to exit early if we find the hash existing.
        // this just is a way to skip the video preview early
        throw new errors.DuplicateMediaError(filepath, checksum, existing_media_file.filepath)
      }
    }
    const [file_size, thumbnails] = await Promise.all([
      file_processor.get_size(),
      file_processor.create_thumbnails(media_file_info, checksum)
    ])

    const transaction = this.ctx.db.transaction_async(async () => {
      const media_reference = this.models.MediaReference.create({
        media_series_reference: false,
        stars: 0,
        view_count: 0,
        ...parsed.media_info 
      })

      const media_file = this.models.MediaFile.create({
        ...media_file_info,
        file_size_bytes: file_size,
        checksum,
        media_reference_id: media_reference.id,
      })!

      for (const tag of parsed.tags) {
        const tag_record = this.tag_create(tag)
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
      await Deno.remove(thumbnails.source_folder, {recursive: true})
      return { media_reference, tags, media_file }
    })

    const transaction_result = await transaction()
    const output_result = this.get_media_file_result({
      media_reference_id: transaction_result.media_reference.id,
      media_file_id: transaction_result.media_file.id,
      thumbnail_limit: 1,
    })
    const creation_duration = performance.now() - start_time
    this.ctx.logger.info(`Created ${parsed.filepath} (type: ${output_result.media_file.media_type} size: ${fmt_bytes.format(output_result.media_file.file_size_bytes)}) in ${fmt_duration.format(creation_duration, {ignoreZero: true})}`)
    return output_result
  }

  protected tag_create(tag: z.output<typeof parsers.Tag>) {
    const group = tag.group ?? ''
    // const color = get_hash_color(group, 'hsl')
    const color = ''
    const tag_group = this.models.TagGroup.get_or_create({ name: group, color })!
    const tag_record = this.models.Tag.get_or_create({ alias_tag_id: null, name: tag.name, tag_group_id: tag_group.id, description: tag.description, metadata: tag.metadata })
    return tag_record
  }

  protected get_media_file_result(params: {
    media_reference_id: number,
    media_file_id: number,
    thumbnail_limit: number
  }) {
    const { media_reference_id, media_file_id, thumbnail_limit } = params
    return {
      media_type: 'media_file' as const,
      media_reference: this.models.MediaReference.select_one({id: media_reference_id}, {or_raise: true}),
      media_file: this.models.MediaFile.select_one({media_reference_id: media_reference_id}, {or_raise: true}),
      tags: this.models.Tag.select_many({media_reference_id: media_reference_id}),
      thumbnails: this.models.MediaThumbnail.select_many({media_file_id: media_file_id, limit: thumbnail_limit}),
    }
  }

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
}

export { Actions }
