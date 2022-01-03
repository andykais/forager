import { MigrationStatement } from '../base'

const TIMESTAMP_SQLITE = `TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))`

export class Migration extends MigrationStatement {
  static VERSION = '0.2.1' as const

  call() {
    const select_media_files_stmt = this.db.prepare('SELECT id, file_size_bytes FROM media_file')
    const select_media_chunk_stmt = this.db.prepare('SELECT id, bytes_start, bytes_end FROM media_chunk WHERE media_file_id = ? ORDER BY id')
    const update_media_chunk_stmt = this.db.prepare(`
    UPDATE media_chunk SET
      bytes_start = @bytes_start,
      bytes_end = @bytes_end
    WHERE id = @media_chunk_id`)

    const { media_file_count } = this.db.prepare('SELECT count(0) as media_file_count FROM media_file').get()
    const { media_chunk_count } = this.db.prepare('SELECT count(0) as media_chunk_count FROM media_chunk').get()

    let files_completed = 0
    let chunks_completed = 0
    for (const media_file of select_media_files_stmt.all()) {
      // let bytes_start = 0
      let chunk_index = 0
      for (const media_chunk of select_media_chunk_stmt.all(media_file.id)) {
        const bytes_start = media_chunk.bytes_start - chunk_index
        const bytes_end = media_chunk.bytes_end - chunk_index
        // console.log({   bytes_start: media_chunk.bytes_start, bytes_end: media_chunk.bytes_end, })
        // const bytes_end: number = bytes_start + media_chunk.bytes_end
        // console.log({   bytes_start: bytes_start, bytes_end: bytes_end, file_size: media_file.file_size_bytes })
        const info = update_media_chunk_stmt.run({ media_chunk_id: media_chunk.id, bytes_start: bytes_start, bytes_end: bytes_end })
        // bytes_start = bytes_end - 1
        if (info.changes !== 1) throw new Error('no changes occurred.')
        chunk_index++
        chunks_completed++
        process.stdout.write(`\rmigrated ${files_completed}/${media_file_count} media files (${chunks_completed}/${media_chunk_count} media chunks)`)
      }
      files_completed++
      process.stdout.write(`\rmigrated ${files_completed}/${media_file_count} media files (${chunks_completed}/${media_chunk_count} media chunks)`)
    }
    console.log('') // just flush the last line of output
  }
}
