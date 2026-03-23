import * as torm from '@torm/sqlite'
import { migrations, TIMESTAMP_SQLITE, TIMESTAMP_COLUMN } from './registry.ts'


@migrations.register()
export class Migration extends torm.Migration {
  version = 11
  override TRANSACTION = false

  call = () => {
    this.driver.exec(`PRAGMA foreign_keys = OFF`)

    console.log(`Rebuilding media_reference_tag with tag_alias_id and tag_parent_id columns`)
    this.driver.exec(`BEGIN TRANSACTION`)

    this.driver.exec(`DROP TRIGGER IF EXISTS media_reference_tag_count_inc`)
    this.driver.exec(`DROP TRIGGER IF EXISTS media_reference_tag_count_dec`)
    this.driver.exec(`DROP TRIGGER IF EXISTS unread_media_reference_tag_count_change`)

    this.driver.exec(`
      CREATE TABLE media_reference_tag_new (
        media_reference_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        editor TEXT,
        tag_group_id INTEGER NOT NULL,
        tag_alias_id INTEGER,
        tag_parent_id INTEGER,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},

        PRIMARY KEY (media_reference_id, tag_id),
        FOREIGN KEY (media_reference_id) REFERENCES media_reference(id),
        FOREIGN KEY (tag_id) REFERENCES tag(id),
        FOREIGN KEY (tag_alias_id) REFERENCES tag_alias(id),
        FOREIGN KEY (tag_parent_id) REFERENCES tag_parent(id)
      )
    `)
    this.driver.exec(`
      INSERT INTO media_reference_tag_new (media_reference_id, tag_id, editor, tag_group_id, updated_at, created_at)
      SELECT media_reference_id, tag_id, editor, tag_group_id, updated_at, created_at
      FROM media_reference_tag
    `)
    this.driver.exec(`DROP TABLE media_reference_tag`)
    this.driver.exec(`ALTER TABLE media_reference_tag_new RENAME TO media_reference_tag`)

    console.log(`Recreating media_reference_tag indexes`)
    this.driver.exec(`CREATE UNIQUE INDEX media_tag_by_reference ON media_reference_tag (tag_id, media_reference_id)`)

    console.log(`Recreating media_reference_tag triggers`)
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

    this.driver.exec(`PRAGMA foreign_key_check`)
    this.driver.exec(`COMMIT`)
    this.driver.exec(`PRAGMA foreign_keys = ON`)
  }
}
