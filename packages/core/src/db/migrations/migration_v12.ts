import * as torm from '@torm/sqlite'
import { migrations, TIMESTAMP_SQLITE } from './registry.ts'


@migrations.register()
export class Migration extends torm.Migration {
  version = 12

  call = () => {
    console.log(`Updating triggers to bump updated_at on media_reference and tag_group`)

    this.driver.exec(`DROP TRIGGER IF EXISTS media_reference_tag_count_inc`)
    this.driver.exec(`DROP TRIGGER IF EXISTS media_reference_tag_count_dec`)
    this.driver.exec(`DROP TRIGGER IF EXISTS tag_group_count_inc`)
    this.driver.exec(`DROP TRIGGER IF EXISTS tag_group_count_dec`)
    this.driver.exec(`DROP TRIGGER IF EXISTS media_series_length_inc`)
    this.driver.exec(`DROP TRIGGER IF EXISTS media_series_length_dec`)

    this.driver.exec(`
      CREATE TRIGGER media_reference_tag_count_inc AFTER INSERT ON media_reference_tag BEGIN
        UPDATE media_reference SET
          tag_count = tag_count + 1,
          updated_at = ${TIMESTAMP_SQLITE}
        WHERE NEW.media_reference_id = id;
        UPDATE tag SET
          updated_at = ${TIMESTAMP_SQLITE},
          media_reference_count = media_reference_count + 1,
          unread_media_reference_count = unread_media_reference_count + (SELECT view_count = 0 FROM media_reference WHERE media_reference.id = NEW.media_reference_id)
        WHERE NEW.tag_id = id;
      END
    `)

    this.driver.exec(`
      CREATE TRIGGER media_reference_tag_count_dec AFTER DELETE ON media_reference_tag BEGIN
        UPDATE media_reference SET
          tag_count = tag_count - 1,
          updated_at = ${TIMESTAMP_SQLITE}
        WHERE OLD.media_reference_id = id;
        UPDATE tag SET
          updated_at = ${TIMESTAMP_SQLITE},
          media_reference_count = media_reference_count - 1,
          unread_media_reference_count = unread_media_reference_count - (SELECT view_count = 0 FROM media_reference WHERE media_reference.id = OLD.media_reference_id)
        WHERE OLD.tag_id = id;
      END
    `)

    this.driver.exec(`
      CREATE TRIGGER tag_group_count_inc AFTER INSERT ON tag BEGIN
        UPDATE tag_group SET
          tag_count = tag_count + 1,
          updated_at = ${TIMESTAMP_SQLITE}
        WHERE NEW.tag_group_id = id;
      END
    `)

    this.driver.exec(`
      CREATE TRIGGER tag_group_count_dec AFTER DELETE ON tag BEGIN
        UPDATE tag_group SET
          tag_count = tag_count - 1,
          updated_at = ${TIMESTAMP_SQLITE}
        WHERE OLD.tag_group_id = id;
      END
    `)

    this.driver.exec(`
      CREATE TRIGGER media_series_length_inc AFTER INSERT ON media_series_item BEGIN
        UPDATE media_reference SET
          media_series_length = media_series_length + 1,
          updated_at = ${TIMESTAMP_SQLITE}
        WHERE NEW.series_id = id;
      END
    `)

    this.driver.exec(`
      CREATE TRIGGER media_series_length_dec AFTER DELETE ON media_series_item BEGIN
        UPDATE media_reference SET
          media_series_length = media_series_length - 1,
          updated_at = ${TIMESTAMP_SQLITE}
        WHERE OLD.series_id = id;
      END
    `)

    console.log(`v12 migration complete`)
  }
}
