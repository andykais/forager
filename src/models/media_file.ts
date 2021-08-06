import { Model, Statement } from '../db/base'

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
  created_at: Date
  media_reference_id: number

  thumbnail: Buffer
  thumbnail_file_size_bytes: number
  thumbnail_md5checksum: string

}

/* --================ Model Definition ================-- */

class MediaFile extends Model {
  insert = this.register(InsertMediaFile)
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

  call(media_file_data: Omit<MediaFileTR, 'id' | 'created_at'>) {
    const sql_data = {...media_file_data, animated: media_file_data.animated ? 1 : 0 }
    const info = this.stmt.ref.run(sql_data)
    return info.lastInsertRowid
  }
}


export { MediaFile }
export type { MediaFileTR }
