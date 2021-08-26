import { Action } from './base'
import { NotFoundError } from '../util/errors'
import { MediaChunk } from '../models/media_chunk'
import { MediaReference } from '../models/media_reference'
import { get_file_size, get_file_info, get_file_checksum, get_buffer_checksum, get_string_checksum, get_file_thumbnail } from '../util/file_processing'
import { TagInput } from '../inputs/tag'
import type { MediaReferenceTR } from '../models/media_reference'
import type { Tag } from '../inputs'

import fs from 'fs'


interface MediaInfo {
  title?: string
  description?: string
  metadata?: any
  source_url?: string
  source_created_at?: Date
}

class MediaAction extends Action {
  async create(filepath: string, media_info: MediaInfo, tags: Tag[]) {
    const media_file_info = await get_file_info(filepath)
    const [file_size_bytes, thumbnail, md5checksum] = await Promise.all([
      get_file_size(filepath),
      get_file_thumbnail(filepath, media_file_info),
      get_file_checksum(filepath),
    ])
    const media_reference_data = { media_sequence_index: 0, ...media_info }
    const media_file_data = {
      ...media_file_info,
      file_size_bytes,
      md5checksum,
      thumbnail,
      thumbnail_file_size_bytes: thumbnail.length,
      thumbnail_md5checksum: get_buffer_checksum(thumbnail),
    }
    return this.db.db.transaction(async () => {
      const media_reference_id = this.db.media_reference.insert(media_reference_data)
      const media_file_id = this.db.media_file.insert({ ...media_file_data, media_reference_id })
      await new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filepath, { highWaterMark: MediaChunk.CHUNK_SIZE })
        stream.on('data', (chunk: Buffer) => this.db.media_chunk.insert({ media_file_id, chunk }))
        stream.on('end', resolve)
        stream.on('error', reject)
      })

      for (const tag of tags) {
        const group = tag.group ?? ''
        const color = get_string_checksum(group).substr(0, 6)
        const tag_group_id = this.db.tag_group.create({ name: group, color })
        const tag_id = this.db.tag.create({ alias_tag_id: null, name: tag.name, tag_group_id })
        this.db.media_reference_tag.insert({ media_reference_id, tag_id })
      }
      return { media_reference_id, media_file_id }
    })()
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

  search(params: {tags: Tag[]; limit?: number; offset?: number }) {
    const { limit = 1000, offset = 0 } = params
    const tag_ids = params.tags.map(tag => {
      const query_data = TagInput.parse(tag)
      const tag_row = this.db.tag.select_one_by_name(query_data)
      if (!tag_row) throw new NotFoundError('Tag', `${query_data.group}:${query_data.name}`)
      return tag_row
    }).map(tag => tag.id)

    const media_references = this.db.media_reference.select_many_by_tags({ tag_ids, limit, offset })
    return media_references
  }

  // TODO offset needs to be replaces w/ a cursor. The cursor will be source_created_at + created_at
  list(params: {limit?: number; offset?: number} = {}) {
    const { limit = 1000, offset = 0 } = params
    return this.db.media_reference.select_many({ limit, offset })
  }

  get_thumbnail(media_reference_id: number) {
    return this.db.media_file.select_thumbnail(media_reference_id)
  }
}

export type { MediaInfo }
export { MediaAction }
