import { Action } from './base'
import { NotFoundError, DuplicateMediaError } from '../util/errors'
import { MediaChunk } from '../models/media_chunk'
import { MediaReference } from '../models/media_reference'
import { get_file_size, get_file_info, get_video_preview , get_file_checksum, get_buffer_checksum, get_file_thumbnail } from '../util/file_processing'
import { get_hash_color } from '../util/text_processing'
import * as inputs from '../inputs'
import type { MediaReferenceTR } from '../models/media_reference'

import fs from 'fs'


interface MediaInfo {
  title?: string
  description?: string
  metadata?: any
  source_url?: string
  source_created_at?: Date
  stars?: number
  view_count?: number
}

class MediaAction extends Action {
  async create(filepath: string, media_info: MediaInfo, tags: inputs.Tag[]) {
    const tags_input = tags.map(t => inputs.TagInput.parse(t))
    const media_file_info = await get_file_info(filepath)
    const [file_size_bytes, thumbnail, sha512checksum, video_preview] = await Promise.all([
      get_file_size(filepath),
      get_file_thumbnail(filepath, media_file_info),
      get_file_checksum(filepath),
      media_file_info.media_type === 'VIDEO' ? get_video_preview(filepath, media_file_info) : null,
    ])
    const media_reference_data = { media_sequence_index: 0, stars: 0, view_count: 0, ...media_info }
    const media_file_data = {
      ...media_file_info,
      file_size_bytes,
      sha512checksum,
      thumbnail,
      thumbnail_file_size_bytes: thumbnail.length,
      thumbnail_sha512checksum: get_buffer_checksum(thumbnail),
      video_preview,
    }
    const transaction = this.db.transaction_async(async () => {
      const media_reference_id = this.db.media_reference.insert(media_reference_data)
      const media_file_id = this.db.media_file.insert({ ...media_file_data, media_reference_id })
      await new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filepath, { highWaterMark: MediaChunk.CHUNK_SIZE })
        stream.on('data', (chunk: Buffer) => this.db.media_chunk.insert({ media_file_id, chunk }))
        stream.on('end', resolve)
        stream.on('error', reject)
      })

      for (const tag of tags_input) {
        const group = tag.group ?? ''
        const color = get_hash_color(group, 'hsl')
        const tag_group_id = this.db.tag_group.create({ name: group, color })
        const tag_id = this.db.tag.create({ alias_tag_id: null, name: tag.name, tag_group_id })
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
  }

  update(media_reference_id: number, media_info: MediaInfo) {
    this.db.media_reference.update(media_reference_id, media_info)
  }

  add_view(media_reference_id: number) {
    this.db.media_reference.inc_view_count(media_reference_id)
  }

  export(media_reference_id: number, output_filepath: string) {
      const media_file = this.db.media_file.select_one({ media_reference_id })
      if (!media_file) throw new NotFoundError('MediaReference', media_reference_id)

      const stream = fs.createWriteStream(output_filepath)
      for (const media_chunk of this.db.media_chunk.iterate({ media_file_id: media_file.id })) {
        stream.write(media_chunk.chunk)
      }
      stream.close()
  }

  search(params: inputs.PaginatedSearch) {
    const { limit, cursor } = inputs.PaginatedSearchInput.parse(params)
    const tag_ids: number[] = []
    if (params.query.tags) {
      for (const tag of params.query.tags) {
        const query_data = inputs.TagInput.parse(tag)
        const tag_row = this.db.tag.select_one_by_name(query_data)
        if (!tag_row) throw new NotFoundError('Tag', `${query_data.group}:${query_data.name}`)
        tag_ids.push(tag_row.id)
      }
    }
    if (params.query.tag_ids) {
      tag_ids.push(...params.query.tag_ids)
    }
    const { stars } = params.query

    const media_references = this.db.media_reference.select_many_by_tags({ tag_ids, stars, limit, cursor })
    return media_references
  }

  // TODO offset needs to be replaces w/ a cursor. The cursor will be source_created_at + created_at
  list(params: inputs.PaginatedQuery = {}) {
    const { limit, cursor } = inputs.PaginatedQueryInput.parse(params)
    return this.db.media_reference.select_many({ limit, cursor })
  }

  get_thumbnail(media_reference_id: number) {
    return this.db.media_file.select_thumbnail(media_reference_id)
  }

  get_video_preview(media_reference_id: number) {
    return this.db.media_file.select_video_preview(media_reference_id)
  }

  get_file(media_reference_id: number) {
    const chunks = this.db.media_chunk.all({ media_reference_id }).map(r => r.chunk)
    return Buffer.concat(chunks)
  }

  get_file_info(media_reference_id: number) {
    const media_file = this.db.media_file.select_one({ media_reference_id })
    // TODO these should be a get_or_raise helper or something
    if (!media_file) throw new Error(`media_file does not exist for media_refernce_id ${media_reference_id}`)
    const media_reference = this.db.media_reference.select_one({ media_reference_id })
    if (!media_reference) throw new Error(`media_file does not exist for media_refernce_id ${media_reference_id}`)
    const tags = this.db.tag.select_many_by_media_reference({ media_reference_id })

    return { media_file, media_reference, tags }
  }

  // methods like these make me nervous because its super granular, which makes it fast,
  // but an orm would avoid the need for a statement, model method, etc
  get_content_type(media_reference_id: number) {
    const content_type = this.db.media_file.select_one_content_type({ media_reference_id },)
    return content_type
  }
}

export type { MediaInfo }
export { MediaAction }
