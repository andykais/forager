import { Model, Statement } from '../queries'

/* --============= Table Row Definitions =============-- */

interface MediaFileTR {
  id: number
  filename: string
  file_size_bytes: number
  md5checksum: string
  media_type: 'VIDEO' | 'IMAGE' | 'AUDIO'
  width?: number
  height?: number
  animated: boolean
  duration: number
  created_at: Date
  media_reference_id: number
}

/* --================ Model Definition ================-- */

class MediaFile extends Model {
  insert = this.register(InsertMediaFile)
}

/* --=================== Statements ===================-- */

class InsertMediaFile extends Statement {
  sql = `INSERT INTO media_file (filename, file_size_bytes, md5checksum, media_type, width, height, animated, duration, media_reference_id) VALUES (@filename, @file_size_bytes, @md5checksum, @media_type, @width, @height, @animated, @duration, @media_reference_id)`
  stmt = this.register(this.sql)

  call(media_file_data: Omit<MediaFileTR, 'id' | 'created_at'>) {
    const sql_data = {...media_file_data, animated: media_file_data.animated ? 1 : 0 }
    this.stmt.ref.run(sql_data)
  }
}


export { MediaFile }
