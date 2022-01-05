import { MigrationStatement } from '../base'

const TIMESTAMP_SQLITE = `STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')`
const TIMESTAMP_COLUMN = `TIMESTAMP DATETIME DEFAULT(${TIMESTAMP_SQLITE})`

export class Migration extends MigrationStatement {
  static VERSION = '0.4.1' as const

  call() {
    this.db.exec(`
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
        framerate INTEGER NOT NULL CHECK (IIF(animated == 0, framerate == 0, 1)),
        duration INTEGER NOT NULL CHECK (IIF(animated == 0, duration == 0, 1)),

        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},

        media_reference_id INTEGER NOT NULL,
        FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
      );

      CREATE TABLE media_thumbnail (
        id INTEGER PRIMARY KEY NOT NULL,
        thumbnail BLOB NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        sha512checksum TEXT NOT NULL,
        thumbnail_index INTEGER NOT NULL,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},

        media_file_id INTEGER NOT NULL,
        FOREIGN KEY (media_file_id) REFERENCES media_reference(id)
      );
    `)

    console.log('insert into media_file_new')
    this.db.exec(`
      INSERT INTO media_file_new (
        id,
        filename,
        file_size_bytes,
        sha512checksum,
        media_type,
        codec,
        content_type,
        width,
        height,
        animated,
        framerate,
        duration,
        updated_at,
        created_at,
        media_reference_id
      ) SELECT
        id,
        filename,
        file_size_bytes,
        sha512checksum,
        media_type,
        codec,
        content_type,
        width,
        height,
        animated,
        0 as framerate,
        duration,
        updated_at,
        created_at,
        media_reference_id
      FROM media_file
    `)

    console.log('foreign_keys = OFF')
    this.db.pragma('foreign_keys = OFF')
    this.db.exec(`PRAGMA foreign_keys = OFF`)
    console.log('DROP TABLE media_file')
    this.db.exec(`DROP TABLE media_file`)
    console.log('ALTER TABLE media_file_new RENAME TO media_file')
    this.db.exec(`ALTER TABLE media_file_new RENAME TO media_file`)
    console.log('foreign_keys = ON')
    this.db.pragma('foreign_keys = ON')
  }
}
