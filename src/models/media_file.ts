import { Model, Statement } from '../db/base'
import type { InsertRow } from '../db/base'
import type { MediaReferenceTR } from './media_reference'

/* --============= Table Row Definitions =============-- */

interface MediaFileTR {
  id: number
  filename: string
  file_size_bytes: number
  md5checksum: string
  media_type: 'VIDEO' | 'IMAGE' | 'AUDIO'
  width: number | null
  height: number | null
  animated: boolean
  duration: number
  updated_at: Date
  created_at: Date
  media_reference_id: MediaReferenceTR['id']

  thumbnail: Buffer
  thumbnail_file_size_bytes: number
  thumbnail_md5checksum: string

}

/* --================ Model Definition ================-- */

class MediaFile extends Model {
  insert = this.register(InsertMediaFile)
  select_one = this.register(SelectOneMediaFile)
}

/* --=================== Statements ===================-- */

class InsertMediaFile extends Statement {
  sql = `INSERT INTO media_file (
    filename,
    file_size_bytes,
    md5checksum,
    media_type,
    width,
    height,
    animated,
    duration,
    media_reference_id,
    thumbnail,
    thumbnail_file_size_bytes,
    thumbnail_md5checksum
  ) VALUES (@filename, @file_size_bytes, @md5checksum, @media_type, @width, @height, @animated, @duration, @media_reference_id, @thumbnail, @thumbnail_file_size_bytes, @thumbnail_md5checksum)`

  stmt = this.register(this.sql)

  call(media_file_data: InsertRow<MediaFileTR>) {
    const sql_data = {...media_file_data, animated: media_file_data.animated ? 1 : 0 }
    const info = this.stmt.ref.run(sql_data)
    return info.lastInsertRowid
  }
}


class SelectOneMediaFile extends Statement {
  sql = `SELECT * FROM media_file
    INNER JOIN media_reference ON media_reference.id = @media_reference_id
    WHERE media_file.id = media_reference.id
  `
  stmt = this.register(this.sql)

  call(query_data: {media_reference_id: MediaReferenceTR['id']}): MediaFileTR | null {
    const row = this.stmt.ref.get(query_data)
    return row
  }
}


export { MediaFile }
export type { MediaFileTR }
