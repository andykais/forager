import { Model, Statement } from '../db/base'
import { NotFoundError } from '../util/errors'
import { TagInput } from '../inputs/tag'
import type { InsertRow, SqliteStatementRef } from '../db/base'
import type { MediaFileTR } from './media_file'
import type { MediaReferenceTR } from './media_reference'

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
  // select_thumbnail_by_reference = this.register(SelectThumbnailByReference)
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


type MediaThumbnailQuery =
  | { media_reference_id: number; thumbnail_index: number }
  | { media_file_id: number; thumbnail_index: number }
  | { thumbnail_id: number }

class SelectThumbnail extends Statement {
  stmt_by_thumbnail_id = this.register(`SELECT * FROM media_thumbnail WHERE id = :thumbnail_id`)
  stmt_by_file_id = this.register(`SELECT * FROM media_thumbnail WHERE media_file_id = :media_file_id AND thumbnail_index = :thumbnail_index`)
  stmt_by_reference_id = this.register(`SELECT * FROM media_thumbnail
    INNER JOIN media_file ON media_file_id = media_file.id
    WHERE media_reference_id = :media_reference_id AND thumbnail_index = :thumbnail_index`)

  call(query_data: MediaThumbnailQuery): MediaThumbnailTR['thumbnail'] {
    if ('media_reference_id' in query_data) return this.get_or_raise(this.stmt_by_reference_id, query_data)
    if ('media_file_id' in query_data) return this.get_or_raise(this.stmt_by_file_id, query_data)
    if ('thumbnail_id' in query_data) return this.get_or_raise(this.stmt_by_thumbnail_id, query_data)
    else throw new Error(`Unexpected thumbnail query ${query_data}`)
  }

  private get_or_raise(stmt: SqliteStatementRef, query_data: MediaThumbnailQuery): MediaThumbnailTR['thumbnail'] {
    const row = stmt.ref.get(query_data)
    if (!row) throw new NotFoundError(SelectThumbnail.name, query_data)
    return row.thumbnail
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
export type { MediaThumbnailTR }
