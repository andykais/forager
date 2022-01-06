import { Model, Statement } from '../db/base'
import { NotFoundError } from '../util/errors'
import { TagInput } from '../inputs/tag'
import type { InsertRow } from '../db/base'
import type { MediaFileTR } from './media_file'

/* --============= Table Row Definitions =============-- */

interface MediaThumbnailTR {
  id: number
  thumbnail: Buffer
  file_size_bytes: number
  sha512checksum: string
  timestamp: number
  thumbnail_index: number
  media_file_id: MediaFileTR['id']
  updated_at: Date
  created_at: Date
}

/* --================ Model Definition ================-- */

class MediaThumbnail extends Model {
  insert = this.register(InsertThumbnail)
  select_thumbnail = this.register(SelectThumbnail)
  select_thumbnails_info = this.register(SelectThumbnailsInfo)
}

/* --=================== Statements ===================-- */

class InsertThumbnail extends Statement {
  sql = `INSERT INTO media_thumbnail (
    thumbnail,
    file_size_bytes,
    sha512checksum,
    timestamp,
    thumbnail_index,
    media_file_id
  ) VALUES (@thumbnail, @file_size_bytes, @sha512checksum, @timestamp, @thumbnail_index, @media_file_id)`

  stmt = this.register(this.sql)

  call(media_thumbnail_data: InsertRow<MediaThumbnailTR>) {
    const sql_data = {...media_thumbnail_data }
    const info = this.stmt.ref.run(sql_data)
    return info.lastInsertRowid as number
  }
}


class SelectThumbnail extends Statement {
  sql = `SELECT thumbnail FROM media_thumbnail WHERE id = ?`

  stmt = this.register(this.sql)

  call(query_data: Pick<MediaThumbnailTR, 'media_file_id' | 'thumbnail_index'>): MediaThumbnailTR['thumbnail'] {
    const result = this.stmt.ref.get(query_data)
    if (result === null) throw new NotFoundError(SelectThumbnail.name, query_data)
    return result.thumbnail
  }
}

class SelectThumbnailsInfo extends Statement {
  sql = `SELECT id, timestamp, thumbnail_index FROM media_thumbnail WHERE media_file_id = :media_file_id ORDER BY thumbnail_index`

  stmt = this.register(this.sql)

  call(query_data: { media_file_id: number }): Pick<MediaThumbnailTR, 'id' | 'timestamp' | 'thumbnail_index'>[] {
    const result = this.stmt.ref.all(query_data)
    if (result.length === 0) throw new NotFoundError(SelectThumbnail.name, query_data)
    return result
  }
}

export { MediaThumbnail }
