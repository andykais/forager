import { MigrationRegistry } from '@torm/sqlite'

// this function is a noop "identity" tagged template literal. It exists purely because some editors pick up the 'sql`....`' template literal to syntax highly the SQL below
export const sql = (strings: TemplateStringsArray, ...values: any[]) => String.raw({ raw: strings }, ...values);

export const TIMESTAMP_SQLITE = `STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')`
export const TIMESTAMP_COLUMN = `TIMESTAMP DATETIME DEFAULT(${TIMESTAMP_SQLITE})`
export const TIMESTAMP_COLUMN_OPTIONAL = `TIMESTAMP DATETIME`

/**
 * Full text search index over the searchable text of a media reference.
 *
 * The rowid is always the media_reference id, which lets searches filter with
 * `media_reference.id IN (SELECT rowid FROM media_reference_fts WHERE ... MATCH ...)`.
 *
 * `title`, `description` and `metadata` are columns on media_reference, while `filepath` is
 * denormalized from the media reference's media_file. `metadata` is indexed as its raw JSON text,
 * so both keys and values are searchable.
 *
 * Shared between the seed migration and migration v12 so that a freshly seeded database and a
 * migrated database always declare an identical index.
 */
export const MEDIA_REFERENCE_FTS_SQL = sql`
  CREATE VIRTUAL TABLE media_reference_fts USING fts5(
    title,
    description,
    metadata,
    filepath,
    tokenize = 'unicode61 remove_diacritics 2'
  );

  CREATE TRIGGER media_reference_fts_insert AFTER INSERT ON media_reference BEGIN
    INSERT INTO media_reference_fts (rowid, title, description, metadata, filepath)
    VALUES (NEW.id, NEW.title, NEW.description, NEW.metadata, NULL);
  END;

  CREATE TRIGGER media_reference_fts_update AFTER UPDATE OF title, description, metadata ON media_reference BEGIN
    UPDATE media_reference_fts SET
      title = NEW.title,
      description = NEW.description,
      metadata = NEW.metadata
    WHERE rowid = NEW.id;
  END;

  CREATE TRIGGER media_reference_fts_delete AFTER DELETE ON media_reference BEGIN
    DELETE FROM media_reference_fts WHERE rowid = OLD.id;
  END;

  CREATE TRIGGER media_file_fts_insert AFTER INSERT ON media_file BEGIN
    UPDATE media_reference_fts SET filepath = NEW.filepath WHERE rowid = NEW.media_reference_id;
  END;

  CREATE TRIGGER media_file_fts_update AFTER UPDATE OF filepath ON media_file BEGIN
    UPDATE media_reference_fts SET filepath = NEW.filepath WHERE rowid = NEW.media_reference_id;
  END;

  CREATE TRIGGER media_file_fts_delete AFTER DELETE ON media_file BEGIN
    UPDATE media_reference_fts SET filepath = NULL WHERE rowid = OLD.media_reference_id;
  END;
  `


export const migrations = new MigrationRegistry()
