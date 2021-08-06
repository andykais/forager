import { Model, Statement } from '../db/base'
import type { MediaFileTR } from './media_file'

/* --============= Table Row Definitions =============-- */

interface MediaChunkTR {
  id: number
  media_file_id: MediaFileTR['id']
  chunk: Buffer
  created_at: Date
}

/* --================ Model Definition ================-- */

class MediaChunk extends Model {
  insert = this.register(InsertMediaChunk)
}

/* --=================== Statements ===================-- */

class InsertMediaChunk extends Statement {
  sql = `INSERT INTO media_chunk (media_file_id, chunk) VALUES (@media_file_id, @chunk)`

  stmt = this.register(this.sql)

  call(media_chunk_data: Omit<MediaChunkTR, 'id' | 'created_at'>) {
    const sql_data = {...media_chunk_data }
    const info = this.stmt.ref.run(sql_data)
    return info.lastInsertRowid
  }
}


export { MediaChunk }
