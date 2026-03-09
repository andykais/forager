import * as torm from '@torm/sqlite'
import { migrations, TIMESTAMP_SQLITE, TIMESTAMP_COLUMN } from './registry.ts'


@migrations.register()
export class Migration extends torm.Migration {
  version = 10
  // PRAGMA foreign_keys cannot be changed inside a transaction, so we manage
  // the transaction ourselves during the table rebuild.
  override TRANSACTION = false

  call = () => {
    console.log(`Adding slug column to tag table`)
    this.driver.exec(`ALTER TABLE tag ADD COLUMN slug TEXT`)
    this.driver.exec(`
      UPDATE tag SET slug = CASE
        WHEN tag_group.name = '' THEN tag.name
        ELSE tag_group.name || ':' || tag.name
      END
      FROM tag_group WHERE tag_group.id = tag.tag_group_id
    `)

    // DROP COLUMN does not work for alias_tag_id because it has a FOREIGN KEY
    // constraint. We must rebuild the table without it. This requires disabling
    // foreign key checks, which cannot be done inside a transaction.
    this.driver.exec(`PRAGMA foreign_keys = OFF`)

    console.log(`Rebuilding tag table: add slug NOT NULL, remove alias_tag_id`)
    this.driver.exec(`BEGIN TRANSACTION`)

    this.driver.exec(`DROP TRIGGER IF EXISTS media_reference_tag_count_inc`)
    this.driver.exec(`DROP TRIGGER IF EXISTS media_reference_tag_count_dec`)
    this.driver.exec(`DROP TRIGGER IF EXISTS tag_group_count_inc`)
    this.driver.exec(`DROP TRIGGER IF EXISTS tag_group_count_dec`)
    this.driver.exec(`DROP TRIGGER IF EXISTS unread_media_reference_tag_count_change`)

    this.driver.exec(`
      CREATE TABLE tag_new (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        tag_group_id INTEGER NOT NULL,
        slug TEXT NOT NULL,
        description TEXT,
        metadata JSON,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},
        media_reference_count INTEGER NOT NULL DEFAULT 0,
        unread_media_reference_count INTEGER NOT NULL DEFAULT 0,

        FOREIGN KEY (tag_group_id) REFERENCES tag_group(id)
      )
    `)
    this.driver.exec(`
      INSERT INTO tag_new (id, name, tag_group_id, slug, description, metadata, updated_at, created_at, media_reference_count, unread_media_reference_count)
      SELECT id, name, tag_group_id, slug, description, metadata, updated_at, created_at, media_reference_count, unread_media_reference_count
      FROM tag
    `)
    this.driver.exec(`DROP TABLE tag`)
    this.driver.exec(`ALTER TABLE tag_new RENAME TO tag`)

    console.log(`Recreating tag indexes`)
    this.driver.exec(`CREATE UNIQUE INDEX tag_name ON tag (name, tag_group_id)`)
    this.driver.exec(`CREATE UNIQUE INDEX tag_slug ON tag (slug)`)

    console.log(`Recreating triggers`)
    this.driver.exec(`
      CREATE TRIGGER media_reference_tag_count_inc AFTER INSERT ON media_reference_tag BEGIN
        UPDATE media_reference SET tag_count = tag_count + 1 WHERE NEW.media_reference_id = id;
        UPDATE tag SET
          updated_at = ${TIMESTAMP_SQLITE},
          media_reference_count = media_reference_count + 1,
          unread_media_reference_count = unread_media_reference_count + (SELECT view_count = 0 FROM media_reference WHERE media_reference.id = NEW.media_reference_id)
        WHERE NEW.tag_id = id;
      END
    `)
    this.driver.exec(`
      CREATE TRIGGER media_reference_tag_count_dec AFTER DELETE ON media_reference_tag BEGIN
        UPDATE media_reference SET tag_count = tag_count - 1 WHERE OLD.media_reference_id = id;
        UPDATE tag SET
          updated_at = ${TIMESTAMP_SQLITE},
          media_reference_count = media_reference_count - 1,
          unread_media_reference_count = unread_media_reference_count - (SELECT view_count = 0 FROM media_reference WHERE media_reference.id = OLD.media_reference_id)
        WHERE OLD.tag_id = id;
      END
    `)
    this.driver.exec(`
      CREATE TRIGGER tag_group_count_inc AFTER INSERT ON tag BEGIN
        UPDATE tag_group SET tag_count = tag_count + 1 WHERE NEW.tag_group_id = id;
      END
    `)
    this.driver.exec(`
      CREATE TRIGGER tag_group_count_dec AFTER DELETE ON tag BEGIN
        UPDATE tag_group SET tag_count = tag_count - 1 WHERE OLD.tag_group_id = id;
      END
    `)
    this.driver.exec(`
      CREATE TRIGGER unread_media_reference_tag_count_change AFTER UPDATE ON media_reference
        WHEN (NEW.view_count > 0 AND OLD.view_count = 0) OR (NEW.view_count = 0 AND OLD.view_count > 0)
      BEGIN
        UPDATE tag SET
          unread_media_reference_count = unread_media_reference_count - (NEW.view_count > 0) + (NEW.view_count = 0)
        WHERE tag.id IN (
          SELECT tag_id as id FROM media_reference_tag WHERE media_reference_id = NEW.id
        );
      END
    `)

    this.driver.exec(`COMMIT`)
    this.driver.exec(`PRAGMA foreign_keys = ON`)
    this.driver.exec(`PRAGMA foreign_key_check`)

    console.log(`Creating tag_alias table`)
    this.driver.exec(`
      CREATE TABLE tag_alias (
        id INTEGER PRIMARY KEY NOT NULL,
        source_tag_slug TEXT NOT NULL,
        target_tag_slug TEXT NOT NULL,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},

        UNIQUE(source_tag_slug, target_tag_slug)
      )
    `)

    console.log(`Creating tag_parent table`)
    this.driver.exec(`
      CREATE TABLE tag_parent (
        id INTEGER PRIMARY KEY NOT NULL,
        source_tag_slug TEXT NOT NULL,
        target_tag_slug TEXT NOT NULL,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},

        UNIQUE(source_tag_slug, target_tag_slug)
      )
    `)
  }
}
