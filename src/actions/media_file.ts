import { Action } from './base'
import { get_file_size, get_file_info, get_file_checksum, get_buffer_checksum, get_string_checksum, get_file_thumbnail } from '../util/file_processing'

import fs from 'fs'


interface Tag {
  group?: string
  name: string
}

interface MediaInfo {
  title?: string
  description?: string
  metadata?: any
  source_url?: string
  source_created_at?: string
}

class MediaFileAction extends Action {
  async create(filepath: string, media_info: MediaInfo, tags: Tag[]) {
    const media_file_info = await get_file_info(filepath)
    const [file_size_bytes, thumbnail, md5checksum] = await Promise.all([
      get_file_size(filepath),
      get_file_thumbnail(filepath, media_file_info),
      get_file_checksum(filepath),
    ])
    const thumbnail_md5checksum = get_buffer_checksum(thumbnail)

    const media_reference_data = {
      title: null,
      source_url: null,
      source_created_at: null,
      description: null,
      metadata: null,
      media_sequence_id: null,
      media_sequence_index: 0,
      ...media_info,
    }
    return this.db.db.transaction(async () => {
      const media_reference_id = this.db.media_reference.insert(media_reference_data)

      const media_file_data = {
        ...media_file_info,
        file_size_bytes,
        md5checksum,
        media_reference_id,

        thumbnail,
        thumbnail_file_size_bytes: thumbnail.length,
        thumbnail_md5checksum,
      }
      const media_file_id = this.db.media_file.insert(media_file_data)

      await new Promise((resolve, reject) => {
        const CHUNK_SIZE = 1024 * 1024 * 2 // (2MB)
        const stream = fs.createReadStream(filepath, { highWaterMark: CHUNK_SIZE })
        stream.on('data', (chunk: Buffer) => this.db.media_chunk.insert({ media_file_id, chunk }))
        stream.on('end', resolve)
        stream.on('error', reject)
      })

      for (const tag of tags) {
        const group = tag.group ?? ''
        const tag_group_id = this.db.tag_group.insert({ name: group, color: get_string_checksum(group).substr(0, 6) })
        const tag_id = this.db.tag.insert({ alias_tag_id: null, name: tag.name, tag_group_id })

        this.db.media_reference_tag.insert({ media_reference_id, tag_id })
      }
      return { media_reference_id, media_file_id }
    })()
  }

  // export(media_reference_id: number, output_filepath: string) {}
  //
  // search(tags: Tag[]): Paginated<MediaReference> {}
}

export { MediaFileAction }
