import { Model, Statement } from '../db/base'
import type { InsertRow } from '../db/base'
import type { MediaFileTR } from './media_file'


/* --============= Table Row Definitions =============-- */

interface MediaChunkTR {
  id: number
  media_file_id: MediaFileTR['id']
  chunk: Buffer
  bytes_start: number
  bytes_end: number
  updated_at: Date
  created_at: Date
}

/* --================ Model Definition ================-- */

class MediaChunk extends Model {
  static CHUNK_SIZE = 1024 * 1024 * 2 // (2MB)

  insert = this.register(InsertMediaChunk)
  iterate = this.register(IterateMediaChunk)
  all = this.register(SelectAllMediaChunks)
  select_chunk_range = this.register(SelectChunkRange)
}

/* --=================== Statements ===================-- */

class InsertMediaChunk extends Statement {
  sql = `INSERT INTO media_chunk (media_file_id, chunk, bytes_start, bytes_end) VALUES (@media_file_id, @chunk, @bytes_start, @bytes_end)`

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

class SelectChunkRange extends Statement {
  sql = `SELECT chunk, bytes_start, bytes_end FROM media_chunk
    INNER JOIN media_file ON media_chunk.media_file_id = media_file.id
    WHERE media_file.media_reference_id = @media_reference_id
    AND bytes_start >= @bytes_start_minus_chunk_size
    AND bytes_end < @bytes_end_plus_chunk_size
    ORDER BY bytes_start`
  stmt = this.register(this.sql)

  call(query_data: { media_reference_id: number; bytes_start: number; bytes_end: number }): Pick<MediaChunkTR, 'chunk' | 'bytes_start' | 'bytes_end'>[] {
    const { media_reference_id, bytes_start, bytes_end } = query_data
    // TODO add chunk calculation (we dont have numbers attached to chunks so...not sure how to do this)
    const chunks = this.stmt.ref.all({
      media_reference_id,
      bytes_start_minus_chunk_size: Math.max(0, bytes_start - MediaChunk.CHUNK_SIZE),
      bytes_end_plus_chunk_size: bytes_end + MediaChunk.CHUNK_SIZE
    })
    return chunks

  }
}

class SelectAllMediaChunks extends Statement {
  sql = `SELECT chunk FROM media_chunk 
    INNER JOIN media_file ON media_chunk.media_file_id = media_file.id
    WHERE media_file.media_reference_id = @media_reference_id`
  stmt = this.register(this.sql)

  call(query_data: { media_reference_id: number }): Pick<MediaChunkTR, 'chunk'>[] {
    return this.stmt.ref.all(query_data)
  }
}


export { MediaChunk }
export type { MediaChunkTR }
