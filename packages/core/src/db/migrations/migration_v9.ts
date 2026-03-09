import * as torm from '@torm/sqlite'
import { migrations, TIMESTAMP_COLUMN, TIMESTAMP_SQLITE } from './registry.ts'


@migrations.register()
export class Migration extends torm.Migration {
  version = 9

  call = () => {
    // Drop dependent triggers/indexes before table rewrites.
    this.driver.exec(`
      DROP TRIGGER IF EXISTS media_reference_tag_count_inc;
      DROP TRIGGER IF EXISTS media_reference_tag_count_dec;
      DROP TRIGGER IF EXISTS tag_group_count_inc;
      DROP TRIGGER IF EXISTS tag_group_count_dec;
      DROP TRIGGER IF EXISTS media_reference_view_count;
      DROP TRIGGER IF EXISTS unread_media_reference_tag_count_change;
      DROP INDEX IF EXISTS media_tag_by_reference;
      DROP INDEX IF EXISTS tag_name;
    `)

    this.driver.exec(`
      CREATE TABLE forager__migration_v9 (
        singleton INTEGER NOT NULL UNIQUE DEFAULT 1 CHECK (singleton = 1),
        version FLOAT NOT NULL,
        name TEXT NOT NULL,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN}
      );

      INSERT INTO forager__migration_v9 (singleton, version, name, updated_at, created_at)
      SELECT singleton, version, name, updated_at, created_at
      FROM forager;

      DROP TABLE forager;
      ALTER TABLE forager__migration_v9 RENAME TO forager;
    `)

    this.driver.exec(`
      CREATE TABLE view__migration_v9 (
        id INTEGER PRIMARY KEY NOT NULL,
        media_reference_id INTEGER NOT NULL,
        start_timestamp FLOAT NOT NULL,
        end_timestamp FLOAT,
        num_loops INTEGER NOT NULL,
        duration FLOAT NOT NULL,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},

        FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
      );

      INSERT INTO view__migration_v9 (
        id,
        media_reference_id,
        start_timestamp,
        end_timestamp,
        num_loops,
        duration,
        updated_at,
        created_at
      )
      SELECT
        id,
        media_reference_id,
        start_timestamp,
        end_timestamp,
        num_loops,
        duration,
        updated_at,
        created_at
      FROM view;

      DROP TABLE view;
      ALTER TABLE view__migration_v9 RENAME TO view;
    `)

    this.driver.exec(`
      CREATE TABLE tag_group__migration_v9 (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},
        tag_count INTEGER NOT NULL DEFAULT 0
      );

      INSERT INTO tag_group__migration_v9 (id, name, color, updated_at, created_at, tag_count)
      SELECT id, name, color, updated_at, created_at, tag_count
      FROM tag_group;

      CREATE TABLE tag__migration_v9_data (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        tag_group_id INTEGER NOT NULL,
        alias_tag_id INTEGER,
        description TEXT,
        metadata JSON,
        updated_at TIMESTAMP DATETIME,
        created_at TIMESTAMP DATETIME,
        media_reference_count INTEGER NOT NULL,
        unread_media_reference_count INTEGER NOT NULL
      );

      INSERT INTO tag__migration_v9_data (
        id,
        name,
        tag_group_id,
        alias_tag_id,
        description,
        metadata,
        updated_at,
        created_at,
        media_reference_count,
        unread_media_reference_count
      )
      SELECT
        id,
        name,
        tag_group_id,
        alias_tag_id,
        description,
        metadata,
        updated_at,
        created_at,
        media_reference_count,
        unread_media_reference_count
      FROM tag;

      CREATE TABLE media_reference_tag__migration_v9_data (
        media_reference_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        editor TEXT,
        tag_group_id INTEGER NOT NULL,
        updated_at TIMESTAMP DATETIME,
        created_at TIMESTAMP DATETIME
      );

      INSERT INTO media_reference_tag__migration_v9_data (
        media_reference_id,
        tag_id,
        editor,
        tag_group_id,
        updated_at,
        created_at
      )
      SELECT
        media_reference_id,
        tag_id,
        editor,
        tag_group_id,
        updated_at,
        created_at
      FROM media_reference_tag;

      DROP TABLE media_reference_tag;
      DROP TABLE tag;
      DROP TABLE tag_group;

      ALTER TABLE tag_group__migration_v9 RENAME TO tag_group;
    `)

    this.driver.exec(`
      CREATE TABLE tag (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        tag_group_id INTEGER NOT NULL,
        alias_tag_id INTEGER,
        description TEXT,
        metadata JSON,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},
        media_reference_count INTEGER NOT NULL DEFAULT 0,
        unread_media_reference_count INTEGER NOT NULL DEFAULT 0,

        FOREIGN KEY (alias_tag_id) REFERENCES tag(id),
        FOREIGN KEY (tag_group_id) REFERENCES tag_group(id)
      );

      INSERT INTO tag (
        id,
        name,
        tag_group_id,
        alias_tag_id,
        description,
        metadata,
        updated_at,
        created_at,
        media_reference_count,
        unread_media_reference_count
      )
      SELECT
        id,
        name,
        tag_group_id,
        alias_tag_id,
        description,
        metadata,
        updated_at,
        created_at,
        media_reference_count,
        unread_media_reference_count
      FROM tag__migration_v9_data;

      DROP TABLE tag__migration_v9_data;
    `)

    this.driver.exec(`
      CREATE TABLE media_reference_tag (
        media_reference_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        editor TEXT,
        tag_group_id INTEGER NOT NULL,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},

        PRIMARY KEY (media_reference_id, tag_id),
        FOREIGN KEY (media_reference_id) REFERENCES media_reference(id),
        FOREIGN KEY (tag_id) REFERENCES tag(id)
      );

      INSERT INTO media_reference_tag (
        media_reference_id,
        tag_id,
        editor,
        tag_group_id,
        updated_at,
        created_at
      )
      SELECT
        media_reference_id,
        tag_id,
        editor,
        tag_group_id,
        updated_at,
        created_at
      FROM media_reference_tag__migration_v9_data;

      DROP TABLE media_reference_tag__migration_v9_data;
    `)

    this.driver.exec(`
      CREATE UNIQUE INDEX media_tag_by_reference ON media_reference_tag (tag_id, media_reference_id);
      CREATE UNIQUE INDEX tag_name ON tag (name, tag_group_id);
    `)

    this.driver.exec(`
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

      CREATE TRIGGER media_reference_view_count AFTER INSERT ON view BEGIN
        UPDATE media_reference SET
          view_count = view_count + 1,
          last_viewed_at = ${TIMESTAMP_SQLITE}
        WHERE NEW.media_reference_id = media_reference.id;
      END;
    `)
  }
}
