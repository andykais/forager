import { Action } from './actions_base.ts'
import { inputs, parsers } from '~/inputs/mod.ts'
import { FileProcessor } from '../lib/file_processing.ts'
import * as errors from '../lib/errors.ts'

class MediaAction extends Action {
  create = async (filepath: string, media_info: inputs.MediaInfo, tags: inputs.Tag[]) => {
    const parsed = {
      media_info: parsers.MediaReferenceUpdate.parse(media_info),
      tags: tags.map(t => parsers.Tag.parse(t)),
    }

    const file_processor = new FileProcessor(this.ctx, filepath)
    const media_file_info = await file_processor.get_info()
    const checksum = await file_processor.get_checksum()

    if (this.ctx.models.MediaFile.find_by_checksum({checksum})) {
      // an non-transactional step to exit early if we find the hash existing.
      // this just is a way to skip the video preview early
      throw new errors.DuplicateMediaError(filepath, checksum)
    }
    throw new Error('unimplemented')
  /*
    inputs.MediaReferenceUpdate.parse(media_info)
    const tags_input = tags.map(t => inputs.Tag.parse(t))
    const media_file_info = await get_file_info(filepath)
    const sha512checksum = await get_file_checksum(filepath)
    if (this.db.media_file.select_one_by_checksum({ sha512checksum })) {
      // an non-transactional step to exit early if we find the hash existing.
      // this just is a way to skip the video preview early
      throw new DuplicateMediaError(filepath, sha512checksum)
    }
    const [file_size_bytes, thumbnails] = await Promise.all([
      get_file_size(filepath),
      get_thumbnails(filepath, media_file_info)
      // get_file_thumbnail(filepath, media_file_info),
      // media_file_info.media_type === 'VIDEO' ? get_video_preview(filepath, media_file_info) : null,
    ])
    const media_reference_data = { media_sequence_index: 0, stars: 0, view_count: 0, ...media_info }
    const media_file_data = {
      ...media_file_info,
      file_size_bytes,
      sha512checksum,
    }
    const transaction = this.db.transaction_async(async () => {
      const media_reference_id = this.db.media_reference.insert(media_reference_data)
      const media_file_id = this.db.media_file.insert({ ...media_file_data, media_reference_id })
      for (const thumbnail_index of thumbnails.keys()) {
        const thumbnail = thumbnails[thumbnail_index]
        this.db.media_thumbnail.insert({ thumbnail_index, media_file_id, ...thumbnail })
      }
      await new Promise((resolve, reject) => {
        let bytes_start = 0
        const stream = fs.createReadStream(filepath, { highWaterMark: MediaChunk.CHUNK_SIZE })
        stream.on('data', (chunk: Buffer) => {
          const bytes_end = bytes_start + chunk.length
          this.db.media_chunk.insert({ media_file_id, chunk, bytes_start, bytes_end })
          bytes_start = bytes_end
        })
        stream.on('end', resolve)
        stream.on('error', reject)
      })

      for (const tag of tags_input) {
        const group = tag.group ?? ''
        const color = get_hash_color(group, 'hsl')
        const tag_group_id = this.db.tag_group.create({ name: group, color })
        const tag_id = this.db.tag.create({ alias_tag_id: null, name: tag.name, tag_group_id, description: tag.description, metadata: tag.metadata })
        this.db.media_reference_tag.insert({ media_reference_id, tag_id })
      }
      return { media_reference_id, media_file_id }
    })

    try {
      return await transaction()
    } catch(e) {
      // TODO this can be handled more robustly if we do a full buffer comparison upon getting a DuplicateMediaError
      // a larger checksum would also be helpful
      // possibly we would put expensive buffer comparisons behind a config flag, opting to just use the duplicate_log otherwise
      if (this.is_unique_constaint_error(e)) throw new DuplicateMediaError(filepath, sha512checksum)
      else throw e
    }
    */
  }

  update = (media_reference_id: number, media_info: inputs.MediaInfo) => {
    throw new Error('unimplemented')
  /*
    const parsed = inputs.MediaReferenceUpdate.parse(media_info)
    this.db.media_reference.update(media_reference_id, parsed)
  */
  }

  add_view = (media_reference_id: number) => {
    throw new Error('unimplemented')
  /*
    this.db.media_reference.inc_view_count(media_reference_id)
  */
  }

  export = (media_reference_id: number, output_filepath: string) => {
    throw new Error('unimplemented')
  /*
      const media_file = this.db.media_file.select_one({ media_reference_id })
      if (!media_file) throw new NotFoundError('MediaFile', { media_reference_id })

      const stream = fs.createWriteStream(output_filepath)
      for (const media_chunk of this.db.media_chunk.iterate({ media_file_id: media_file.id })) {
        stream.write(media_chunk.chunk)
      }
      stream.close()
    */
  }

  search = (params: inputs.PaginatedSearch) => {
    throw new Error('unimplemented')
  /*
    const input = inputs.PaginatedSearch.parse(params)
    const tag_ids: number[] = []
    if (params.query.tags) {
      for (const tag of params.query.tags) {
        const query_data = inputs.Tag.parse(tag)
        const tag_row = this.db.tag.select_one_by_name(query_data)
        if (!tag_row) throw new NotFoundError('Tag', `${query_data.group}:${query_data.name}`)
        tag_ids.push(tag_row.id)
      }
    }
    if (params.query.tag_ids) {
      tag_ids.push(...params.query.tag_ids)
    }
    const { limit, cursor } = input
    const { stars, stars_equality, unread, sort_by, order } = input.query

    return this.db.media_reference.select_many({ tag_ids, stars, stars_equality, unread, sort_by, order, limit, cursor })
  */
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

  // TODO offset needs to be replaces w/ a cursor. The cursor will be source_created_at + created_at
  list = (params: inputs.PaginatedQuery = {}) => {
    throw new Error('unimplemented')
  /*
    const { limit, cursor } = inputs.PaginatedQuery.parse(params)
    return this.db.media_reference.select_many({ limit, cursor, sort_by: 'created_at', order: 'desc' })
  */
  }


  get_reference = (media_reference_id: number) => {
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


export { MediaAction }
