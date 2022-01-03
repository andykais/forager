import { MigrationStatement } from '../base'

const TIMESTAMP_SQLITE = `TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))`

export class Migration extends MigrationStatement {
  static VERSION = '0.2.0' as const

  call() {
    const { media_file_count } = this.db.prepare('SELECT count(0) as media_file_count FROM media_file').get()
    const { media_chunk_count } = this.db.prepare('SELECT count(0) as media_chunk_count FROM media_chunk').get()
    this.db.exec(`
      CREATE TABLE media_chunk_new (
        id INTEGER PRIMARY KEY NOT NULL,
        media_file_id INTEGER NOT NULL,
        chunk BLOB NOT NULL,
        bytes_start INTEGER NOT NULL,
        bytes_end INTEGER NOT NULL,
        updated_at ${TIMESTAMP_SQLITE},
        created_at ${TIMESTAMP_SQLITE},

        FOREIGN KEY (media_file_id) REFERENCES media_file(id)
      );
    `)

    const select_media_files_stmt = this.db.prepare('SELECT id FROM media_file')
    const select_media_chunk_stmt = this.db.prepare('SELECT id, LENGTH(chunk) AS chunk_size FROM media_chunk WHERE media_file_id = ? ORDER BY id')
    const insert_media_chunk_stmt = this.db.prepare(`INSERT INTO media_chunk_new
    SELECT
      id,
      media_file_id,
      chunk,
      @bytes_start AS bytes_start,
      @bytes_end AS bytes_end,
      updated_at,
      created_at
    FROM media_chunk
    WHERE id = @media_chunk_id`)

    let files_completed = 0
    let chunks_completed = 0
    for (const media_file of select_media_files_stmt.all()) {
      let bytes_start = 0
      for (const media_chunk of select_media_chunk_stmt.all(media_file.id)) {
        const bytes_end: number = bytes_start + media_chunk.chunk_size
        const info = insert_media_chunk_stmt.run({ media_chunk_id: media_chunk.id, bytes_start, bytes_end })
        if (info.changes !== 1) throw new Error('no changes occurred.')
        bytes_start = bytes_end + 1
        chunks_completed++
        process.stdout.write(`\rmigrated ${files_completed}/${media_file_count} media files (${chunks_completed}/${media_chunk_count} media chunks)`)
      }
      files_completed++
      process.stdout.write(`\rmigrated ${files_completed}/${media_file_count} media files (${chunks_completed}/${media_chunk_count} media chunks)`)
    }
    this.db.exec(`
      DROP TABLE media_chunk;
      ALTER TABLE media_chunk_new RENAME TO media_chunk;
      CREATE UNIQUE INDEX media_chunk_range ON media_chunk (media_file_id, bytes_start, bytes_end);
    `)
    console.log('') // just flush the last line of output
  }
}
