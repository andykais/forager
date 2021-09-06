import { Model, Statement } from '../db/base'

/* --============= Table Row Definitions =============-- */

interface SqliteMasterTR {
  tbl_name: string
  sql: string
}

interface ForagerTR {
  version: string
  name: string
  created_at: Date
}


/* --================ Model Definition ================-- */

class TableManager extends Model {
  drop_tables = this.register(DropTables)
  create_tables = this.register(CreateTables)
  get_table_definitions = this.register(GetTableDefinitions)
  get_forager_metadata = this.register(GetForagerMetadata)
  set_forager_metadata = this.register(SetForagerMetadata)

  tables_exist() {
    const res = this.get_table_definitions()
    return res.some(row => row.tbl_name === 'forager')
  }

  tables_schema() {
    return this.get_table_definitions()
      .filter(row => row.sql !== null) // skip the builtin auto definitions
      .map(row => row.sql)
      .map(sql => sql.replace(/^\s+/mg, '')) // remove excess whitespace
      .map(sql => sql.replace(/CREATE TABLE "(.*?)"/g, (_, name) => `CREATE TABLE ${name}`)) // remove optional quotes around table name
      .join('\n')
  }
}


/* --=================== Statements ===================-- */

class SetForagerMetadata extends Statement {
  sql = `INSERT INTO forager (version, name) VALUES (?, ?) ON CONFLICT DO UPDATE SET version = excluded.version`
  stmt = this.register(this.sql)

  call(version: string) {
    this.db.prepare(this.sql).run(version, 'FORAGER_PLACEHOLDER_NAME')
  }
}


class GetForagerMetadata extends Statement {
  sql = `SELECT * FROM forager`
  stmt = this.register(this.sql)

  call(): ForagerTR {
    const row = this.db.prepare(this.sql).get()
    return { ...row, created_at: new Date(row.created_at) }
    // return this.stmt.ref.get()
  }

}

class GetTableDefinitions extends Statement {
  sql = `SELECT tbl_name, sql FROM sqlite_master ORDER BY tbl_name`
  stmt = this.register(this.sql)

  call(): SqliteMasterTR[] {
    return this.db.prepare(this.sql).all()
  }

}


class DropTables extends Statement {
  sql = `
    DROP TABLE IF EXISTS media_chunk;
    DROP TABLE IF EXISTS media_file;
    DROP TABLE IF EXISTS media_sequence;
    DROP TABLE IF EXISTS media_reference;
    DROP TABLE IF EXISTS media_reference_tag;
    DROP TABLE IF EXISTS tag;
    DROP TABLE IF EXISTS tag_group;
    DROP TABLE IF EXISTS forager;

    DROP INDEX IF EXISTS media_tag;
    DROP INDEX IF EXISTS tag_name;
    DROP INDEX IF EXISTS media_file_text_search ;
    DROP INDEX IF EXISTS media_file_type;
    DROP INDEX IF EXISTS duplicate_log;`

  call() {
    this.db.exec(this.sql)
  }
}

const TIMESTAMP_SQLITE = `TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))`

class CreateTables extends Statement {
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
      md5checksum TEXT NOT NULL UNIQUE,

      -- image,video,audio
      media_type TEXT NOT NULL CHECK( media_type IN ('IMAGE', 'VIDEO', 'AUDIO') ),
      -- image/video
      width  INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND width  IS NOT NULL),
      height INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND height IS NOT NULL),
      -- audio/video/gif specific
      animated BOOLEAN NOT NULL,
      duration INTEGER NOT NULL CHECK (IIF(animated == 0, duration == 0, 1)),

      -- TODO should we use a separate table for thumbnails?
      thumbnail BLOB NOT NULL,
      thumbnail_file_size_bytes INTEGER NOT NULL,
      thumbnail_md5checksum TEXT NOT NULL,

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

      updated_at ${TIMESTAMP_SQLITE},
      created_at ${TIMESTAMP_SQLITE},

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

      FOREIGN KEY (alias_tag_id) REFERENCES tag(id),
      FOREIGN KEY (tag_group_id) REFERENCES tag_group(id)
    );


    CREATE TABLE tag_group (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL UNIQUE,
      updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
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
      md5checksum TEXT NOT NULL,
      updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
    );


    -- triggers --
    -- NOTE these do not have their schema checked for some odd reason. Its up to tests and devs to make sure these arent out of sync
    -- follow up note: this is a bad idea. Lets just add some serialization helpers to these babys
    -- CREATE TRIGGER media_chunk_update_trigger AFTER UPDATE ON media_chunk BEGIN UPDATE media_chunk SET updated_at = CURRENT_TIMESTAMP WHERE new.id = id; END;
    -- CREATE TRIGGER media_file_update_trigger AFTER UPDATE ON media_file BEGIN UPDATE media_file SET updated_at = CURRENT_TIMESTAMP WHERE new.id = id; END;
    -- CREATE TRIGGER media_sequence_update_trigger AFTER UPDATE ON media_sequence BEGIN UPDATE media_sequence SET updated_at = CURRENT_TIMESTAMP WHERE new.id = id; END;
    -- CREATE TRIGGER media_reference_update_trigger AFTER UPDATE ON media_reference BEGIN UPDATE media_reference SET updated_at = CURRENT_TIMESTAMP WHERE new.id = id; END;
    -- CREATE TRIGGER media_reference_tag_update_trigger AFTER UPDATE ON media_reference_tag BEGIN UPDATE media_reference_tag SET updated_at = CURRENT_TIMESTAMP WHERE new.id = id; END;
    -- CREATE TRIGGER tag_update_trigger AFTER UPDATE ON tag BEGIN UPDATE tag SET updated_at = CURRENT_TIMESTAMP WHERE new.id = id; END;
    -- CREATE TRIGGER tag_group_update_trigger AFTER UPDATE ON tag_group BEGIN UPDATE tag_group SET updated_at = CURRENT_TIMESTAMP WHERE id = new.id; END;
    -- CREATE TRIGGER forager_update_trigger AFTER INSERT ON forager BEGIN UPDATE forager SET updated_at = CURRENT_TIMESTAMP WHERE new.name = name; END;

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

export { TableManager }
