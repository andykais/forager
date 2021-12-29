import { MigrationStatement } from '../base'

const TIMESTAMP_SQLITE = `STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')`
const TIMESTAMP_COLUMN = `TIMESTAMP DATETIME DEFAULT(${TIMESTAMP_SQLITE})`


export class Migration extends MigrationStatement {
  static VERSION = '0.3.0' as const

  call() {
    // create table media_file_new
    // select media files
    // write files to tmp
    // ffmpeg create thumbnails
    // insert into media_file_new table rows
    // drop media_file
    // rename media_file_new to media_file

    this.db.prepare(`
      CREATE TABLE media_file_new (
        id INTEGER PRIMARY KEY NOT NULL,
        filename TEXT NOT NULL,
        -- mime_type TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        sha512checksum TEXT NOT NULL UNIQUE,

        -- image,video,audio
        media_type TEXT NOT NULL CHECK( media_type IN ('IMAGE', 'VIDEO', 'AUDIO') ),
        codec TEXT NOT NULL,
        content_type TEXT NOT NULL,
        -- image/video
        width  INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND width  IS NOT NULL),
        height INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND height IS NOT NULL),
        -- audio/video/gif specific
        animated BOOLEAN NOT NULL,
        duration INTEGER NOT NULL CHECK (IIF(animated == 0, duration == 0, 1)),
        framerate INTEGER NOT NULL,

        -- TODO should we use a separate table for thumbnails?
        thumbnail BLOB NOT NULL,
        thumbnail_file_size_bytes INTEGER NOT NULL,
        thumbnail_sha512checksum TEXT NOT NULL,

        video_preview BLOB,

        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},

        media_reference_id INTEGER NOT NULL,
        FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
      )`).run()

      this.db.prepare(`
        CREATE TABLE thumbnails (
          id INTEGER PRIMARY KEY NOT NULL,
          media_file_id INTEGER NOT NULL,
          FOREIGN KEY (media_file_id) REFERENCES media_file_new(id)
        )
      `).run()


      const select_all_media_files = this.db.prepare('SELECT id FROM media_file')
      const select_media_chunks = this.db.prepare('SELECT chunk FROM media_chunk WHERE media_file_id = ?')
      for (const media_file of select_all_media_files.all()) {
        const chunks = select_media_chunks.get(media_file.id)
        // const file_buffer = Buffer.
      }






    // const select_media_files_stmt = this.db.prepare('SELECT id, file_size_bytes FROM media_file')
    // const select_media_chunk_stmt = this.db.prepare('SELECT id, bytes_start, bytes_end FROM media_chunk WHERE media_file_id = ? ORDER BY id')
    // const update_media_chunk_stmt = this.db.prepare(`
    // UPDATE media_chunk SET
    //   bytes_start = @bytes_start,
    //   bytes_end = @bytes_end
    // WHERE id = @media_chunk_id`)

    // const { media_file_count } = this.db.prepare('SELECT count(0) as media_file_count FROM media_file').get()
    // const { media_chunk_count } = this.db.prepare('SELECT count(0) as media_chunk_count FROM media_chunk').get()

    // let files_completed = 0
    // let chunks_completed = 0
    // for (const media_file of select_media_files_stmt.all()) {
    //   // let bytes_start = 0
    //   let chunk_index = 0
    //   for (const media_chunk of select_media_chunk_stmt.all(media_file.id)) {
    //     const bytes_start = media_chunk.bytes_start - chunk_index
    //     const bytes_end = media_chunk.bytes_end - chunk_index
    //     // console.log({   bytes_start: media_chunk.bytes_start, bytes_end: media_chunk.bytes_end, })
    //     // const bytes_end: number = bytes_start + media_chunk.bytes_end
    //     // console.log({   bytes_start: bytes_start, bytes_end: bytes_end, file_size: media_file.file_size_bytes })
    //     const info = update_media_chunk_stmt.run({ media_chunk_id: media_chunk.id, bytes_start: bytes_start, bytes_end: bytes_end })
    //     // bytes_start = bytes_end - 1
    //     if (info.changes !== 1) throw new Error('no changes occurred.')
    //     chunk_index++
    //     chunks_completed++
    //     process.stdout.write(`\rmigrated ${files_completed}/${media_file_count} media files (${chunks_completed}/${media_chunk_count} media chunks)`)
    //   }
    //   files_completed++
    //   process.stdout.write(`\rmigrated ${files_completed}/${media_file_count} media files (${chunks_completed}/${media_chunk_count} media chunks)`)
    // }
    // console.log() // just flush the last line of output
  }
}
