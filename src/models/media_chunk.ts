import { Model, Statement } from '../db/base'
import type { InsertRow } from '../db/base'
import type { MediaFileTR } from './media_file'


/* --============= Table Row Definitions =============-- */

interface MediaChunkTR {
  id: number
  media_file_id: MediaFileTR['id']
  chunk: Buffer
  updated_at: Date
  created_at: Date
}

/* --================ Model Definition ================-- */

class MediaChunk extends Model {
  static CHUNK_SIZE = 1024 * 1024 * 2 // (2MB)

  insert = this.register(InsertMediaChunk)
  iterate = this.register(IterateMediaChunk)
}

/* --=================== Statements ===================-- */

class InsertMediaChunk extends Statement {
  sql = `INSERT INTO media_chunk (media_file_id, chunk) VALUES (@media_file_id, @chunk)`

  stmt = this.register(this.sql)

  call(media_chunk_data: InsertRow<MediaChunkTR>) {
    const sql_data = {...media_chunk_data }
    const info = this.stmt.ref.run(sql_data)
    return info.lastInsertRowid as number
  }
}


class IterateMediaChunk extends Statement {
  sql = `SELECT * FROM media_chunk WHERE media_file_id = @media_file_id`
  stmt = this.register(this.sql)

  call(query_data: { media_file_id: number }): Iterable<MediaChunkTR> {
    return this.stmt.ref.iterate(query_data)
  }
}


export { MediaChunk }
export type { MediaChunkTR }
