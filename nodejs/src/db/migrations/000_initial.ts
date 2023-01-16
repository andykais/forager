import { MigrationStatement } from '../base'

const TIMESTAMP_SQLITE = `TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))`

export class Migration extends MigrationStatement {
  // only used for testing purposes
  static VERSION = '0.0.0' as const

  sql = `
    CREATE TABLE media_chunk (
      id INTEGER PRIMARY KEY NOT NULL,
      media_file_id INTEGER NOT NULL,
      -- 1MiB chunks
      chunk BLOB NOT NULL,
      updated_at ${TIMESTAMP_SQLITE},
      created_at ${TIMESTAMP_SQLITE},

      FOREIGN KEY (media_file_id) REFERENCES media_file(id)
    );


    CREATE TABLE media_file (
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

      -- TODO should we use a separate table for thumbnails?
      thumbnail BLOB NOT NULL,
      thumbnail_file_size_bytes INTEGER NOT NULL,
      thumbnail_sha512checksum TEXT NOT NULL,

      video_preview BLOB,

      updated_at ${TIMESTAMP_SQLITE},
      created_at ${TIMESTAMP_SQLITE},

      media_reference_id INTEGER NOT NULL,
      FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
    );

    CREATE TABLE media_sequence (
      id INTEGER PRIMARY KEY NOT NULL,
      media_reference_id INTEGER NOT NULL,
      updated_at ${TIMESTAMP_SQLITE},
      created_at ${TIMESTAMP_SQLITE},

      FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
    );


    -- Polymorphic table referenced by either media files or media sequences
    -- NOTE we do not enforce that a media_reference is only referenced by either media_sequence or media_file, nor do we constrain it to always reference one
    CREATE TABLE media_reference (
      id INTEGER PRIMARY KEY NOT NULL,

      media_sequence_id INTEGER,
      media_sequence_index INTEGER NOT NULL DEFAULT 0,

      source_url TEXT,
      source_created_at DATETIME,
      title TEXT,
      description TEXT,
      metadata JSON,

      stars INTEGER NOT NULL,
      view_count INTEGER NOT NULL,

      updated_at ${TIMESTAMP_SQLITE},
      created_at ${TIMESTAMP_SQLITE},

      -- denormalized fields
      tag_count INTEGER NOT NULL DEFAULT 0,

      FOREIGN KEY (media_sequence_id) REFERENCES media_sequence(id)
    );


    CREATE TABLE media_reference_tag (
      media_reference_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),

      PRIMARY KEY (media_reference_id, tag_id),
      FOREIGN KEY (media_reference_id) REFERENCES media_reference(id),
      FOREIGN KEY (tag_id) REFERENCES tag(id)
    );


    -- TODO 'tag' text searches are slow, try creating a full text search virtual table
    /* CREATE VIRTUAL TABLE tag USING FTS5(name); */
    CREATE TABLE tag (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      tag_group_id INTEGER NOT NULL,
      -- some tags will just be aliases for others. We have to be careful not to have cyclical references here
      alias_tag_id INTEGER,
      updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      -- denormalized fields
      media_reference_count INTEGER NOT NULL DEFAULT 0,

      FOREIGN KEY (alias_tag_id) REFERENCES tag(id),
      FOREIGN KEY (tag_group_id) REFERENCES tag_group(id)
    );


    CREATE TABLE tag_group (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL UNIQUE,
      updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      -- denormalized fields
      tag_count INTEGER NOT NULL DEFAULT 0
    );


    CREATE TABLE forager (
      -- id INTEGER PRIMARY KEY NOT NULL,
      singleton INTEGER NOT NULL UNIQUE DEFAULT 1 CHECK (singleton = 1), -- ensure only a single row can be inserted
      version FLOAT NOT NULL,
      name TEXT NOT NULL,
      updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
    );

    CREATE TABLE duplicate_log (
      filepath TEXT NOT NULL,
      sha512checksum TEXT NOT NULL,
      updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
    );


    -- triggers --
    CREATE TRIGGER media_reference_tag_count_inc AFTER INSERT ON media_reference_tag BEGIN
      UPDATE media_reference SET tag_count = tag_count + 1 WHERE NEW.media_reference_id = id;
      UPDATE tag SET media_reference_count = media_reference_count + 1 WHERE NEW.tag_id = id;
    END;
    CREATE TRIGGER media_reference_tag_count_dec AFTER DELETE ON media_reference_tag BEGIN
      UPDATE media_reference SET tag_count = tag_count - 1 WHERE OLD.media_reference_id = id;
      UPDATE tag SET media_reference_count = media_reference_count - 1 WHERE OLD.tag_id = id;
    END;
    CREATE TRIGGER tag_group_count_inc AFTER INSERT ON tag BEGIN
      UPDATE tag_group SET tag_count = tag_count + 1 WHERE NEW.tag_group_id = id;
    END;
    CREATE TRIGGER tag_group_count_dec AFTER DELETE ON tag BEGIN
      UPDATE tag_group SET tag_count = tag_count - 1 WHERE OLD.tag_group_id = id;
    END;

    -- NOTES: lets use the "INDEXED BY <index_name>" clause to hardcode indexes to look things up with
    -- It will be cool and way easier to determine what queries are used

    CREATE UNIQUE INDEX media_tag ON media_reference_tag (tag_id, media_reference_id);
    CREATE UNIQUE INDEX tag_name ON tag (name, tag_group_id);
    CREATE UNIQUE INDEX media_file_reference ON media_file (media_reference_id);
    CREATE INDEX media_file_type ON media_file (media_type, animated);`


  call() {
    this.db.exec(this.sql)
  }
}
