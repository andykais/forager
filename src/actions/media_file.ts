import { Action } from './base'
import { get_file_size, get_file_info, get_file_checksum, get_file_thumbnail } from '../util/file_processing'


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

    const media_reference_id = -1
    const media_file_data = {
      ...media_file_info,
      file_size_bytes,
      md5checksum,
      media_reference_id,
    }
    this.context.db.media_file.insert(media_file_data)
  }
}

export { MediaFileAction }
