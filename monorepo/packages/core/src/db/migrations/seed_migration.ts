import * as torm from '@torm/sqlite'
import { migrations } from './registry.ts'


const TIMESTAMP_SQLITE = `STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')`
const TIMESTAMP_COLUMN = `TIMESTAMP DATETIME DEFAULT(${TIMESTAMP_SQLITE})`


// this function is a noop "identity" tagged template literal. It exists purely because some editors pick up the 'sql`....`' template literal to syntax highly the SQL below
const sql = (strings: TemplateStringsArray, ...values: any[]) => String.raw({ raw: strings }, ...values);


@migrations.register()
export class Migration extends torm.SeedMigration {
  version = '1.0.0'

  sql = sql`
    CREATE TABLE media_file (
      id INTEGER PRIMARY KEY NOT NULL,
      filepath TEXT NOT NULL,
      filename TEXT NOT NULL,
      thumbnail_directory_path TEXT NOT NULL UNIQUE,
      -- mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      checksum TEXT NOT NULL UNIQUE,

      -- image,video,audio
      media_type TEXT NOT NULL CHECK( media_type IN ('IMAGE', 'VIDEO', 'AUDIO') ),
      codec TEXT NOT NULL,
      content_type TEXT NOT NULL,
      -- image/video
      width  INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND width  IS NOT NULL OR media_type = 'AUDIO'),
      height INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND height IS NOT NULL OR media_type = 'AUDIO'),
      -- audio/video/gif specific
      animated BOOLEAN NOT NULL,
      audio BOOLEAN NOT NULL,
      framerate INTEGER NOT NULL CHECK (IIF(animated == 0, framerate == 0, 1) OR media_type = 'AUDIO'),
      duration INTEGER NOT NULL CHECK (IIF(animated == 0, duration == 0, 1) OR media_type = 'AUDIO'),

      updated_at ${TIMESTAMP_COLUMN},
      created_at ${TIMESTAMP_COLUMN},

      media_reference_id INTEGER NOT NULL,
      FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
    );

    CREATE TABLE media_thumbnail (
      id INTEGER PRIMARY KEY NOT NULL,
      media_timestamp FLOAT NOT NULL,
      kind TEXT NOT NULL CHECK( kind IN ('standard', 'keypoint') ),
      media_file_id INTEGER NOT NULL,
      filepath TEXT NOT NULL UNIQUE,
      updated_at ${TIMESTAMP_COLUMN},
      created_at ${TIMESTAMP_COLUMN},

      FOREIGN KEY (media_file_id) REFERENCES media_file(id)
    );

    CREATE TABLE media_keypoint (
      id INTEGER PRIMARY KEY NOT NULL,
      media_timestamp FLOAT NOT NULL,
      duration FLOAT NOT NULL,
      media_reference_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      updated_at ${TIMESTAMP_COLUMN},
      created_at ${TIMESTAMP_COLUMN},

      FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
      FOREIGN KEY (tag_id) REFERENCES tag(id)
    );

    CREATE TABLE media_series_item (
      id INTEGER PRIMARY KEY NOT NULL,
      media_reference_id INTEGER NOT NULL,
      series_id INTEGER NOT NULL,
      series_index INTEGER NOT NULL,
      filesystem_reference BOOLEAN NOT NULL,

      updated_at ${TIMESTAMP_COLUMN},
      created_at ${TIMESTAMP_COLUMN},

      FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
      FOREIGN KEY (series_id) REFERENCES media_reference(id)
    );


    -- Polymorphic table referenced by either media files or media sequences
    -- NOTE we do not enforce that a media_reference is only referenced by either media_sequence or media_file, nor do we constrain it to always reference one
    CREATE TABLE media_reference (
      id INTEGER PRIMARY KEY NOT NULL,

      source_url TEXT,
      source_created_at DATETIME,
      title TEXT,
      description TEXT,
      metadata JSON,

      stars INTEGER NOT NULL,
      view_count INTEGER NOT NULL,

      -- media series reference fields
      media_series_reference BOOLEAN NOT NULL,
      directory_reference BOOLEAN NOT NULL,
      directory_path TEXT,
      directory_root BOOLEAN NOT NULL,

      updated_at ${TIMESTAMP_COLUMN},
      created_at ${TIMESTAMP_COLUMN},

      -- denormalized fields
      tag_count INTEGER NOT NULL DEFAULT 0,
      media_series_length INTEGER NOT NULL DEFAULT 0
    );


    CREATE TABLE media_reference_tag (
      media_reference_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      tag_group_id INTEGER NOT NULL,
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
      description TEXT,
      metadata JSON,
      updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      -- denormalized fields
      media_reference_count INTEGER NOT NULL DEFAULT 0,
      unread_media_reference_count INTEGER NOT NULL DEFAULT 0,

      FOREIGN KEY (alias_tag_id) REFERENCES tag(id),
      FOREIGN KEY (tag_group_id) REFERENCES tag_group(id)
    );


    CREATE TABLE tag_group (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      -- denormalized fields
      tag_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE view (
      id INTEGER PRIMARY KEY NOT NULL,
      media_reference_id INTEGER NOT NULL,
      start_timestamp FLOAT NOT NULL,
      end_timestamp FLOAT,
      num_loops INTEGER NOT NULL,
      duration FLOAT NOT NULL,
      updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),

      FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
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
      checksum TEXT NOT NULL,
      updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
    );


    -- triggers --

    CREATE TRIGGER media_reference_tag_count_inc AFTER INSERT ON media_reference_tag BEGIN
      UPDATE media_reference SET tag_count = tag_count + 1 WHERE NEW.media_reference_id = id;
      UPDATE tag SET
        updated_at = ${TIMESTAMP_SQLITE},
        media_reference_count = media_reference_count + 1,
        unread_media_reference_count = unread_media_reference_count + (SELECT view_count = 0 FROM media_reference WHERE media_reference.id = NEW.media_reference_id)
      WHERE NEW.tag_id = id;
    END;

    CREATE TRIGGER media_reference_tag_count_dec AFTER DELETE ON media_reference_tag BEGIN
      UPDATE media_reference SET tag_count = tag_count - 1 WHERE OLD.media_reference_id = id;
      UPDATE tag SET
        updated_at = ${TIMESTAMP_SQLITE},
        media_reference_count = media_reference_count - 1,
        unread_media_reference_count = unread_media_reference_count - (SELECT view_count = 0 FROM media_reference WHERE media_reference.id = OLD.media_reference_id)
      WHERE OLD.tag_id = id;
    END;

    CREATE TRIGGER tag_group_count_inc AFTER INSERT ON tag BEGIN
      UPDATE tag_group SET tag_count = tag_count + 1 WHERE NEW.tag_group_id = id;
    END;

    CREATE TRIGGER tag_group_count_dec AFTER DELETE ON tag BEGIN
      UPDATE tag_group SET tag_count = tag_count - 1 WHERE OLD.tag_group_id = id;
    END;

    CREATE TRIGGER unread_media_reference_tag_count_change AFTER UPDATE ON media_reference
      WHEN (NEW.view_count > 0 AND OLD.view_count = 0) OR (NEW.view_count = 0 AND OLD.view_count > 0)
    BEGIN
        UPDATE tag SET
          unread_media_reference_count = unread_media_reference_count - (NEW.view_count > 0) + (NEW.view_count = 0)
        WHERE tag.id IN (
          SELECT tag_id as id FROM media_reference_tag WHERE media_reference_id = NEW.id
        );
    END;

    CREATE TRIGGER media_series_length_inc AFTER INSERT ON media_series_item BEGIN
      UPDATE media_reference SET media_series_length = media_series_length + 1 WHERE NEW.series_id = id;
    END;

    CREATE TRIGGER media_series_length_dec AFTER DELETE ON media_series_item BEGIN
      UPDATE media_reference SET media_series_length = media_series_length - 1 WHERE OLD.series_id = id;
    END;


    -- NOTES: lets use the "INDEXED BY <index_name>" clause to hardcode indexes to look things up with
    -- It will be cool and way easier to determine what queries are used

    CREATE UNIQUE INDEX media_tag_by_reference ON media_reference_tag (tag_id, media_reference_id);
    CREATE UNIQUE INDEX tag_name ON tag (name, tag_group_id);
    CREATE UNIQUE INDEX media_file_reference ON media_file (media_reference_id);
    CREATE UNIQUE INDEX media_filepath ON media_file (filepath);
    -- it seems like sqlite doesnt count NULL values as unique? This works for our use case so whatevs
    CREATE UNIQUE INDEX media_reference_directory_path ON media_reference (directory_path);
    CREATE UNIQUE INDEX directory_media_series_item ON media_series_item (series_id, media_reference_id) WHERE media_series_item.filesystem_reference = 1;
    `


  call() {
    this.driver.exec(this.sql)
  }
}

export { migrations }
