import { MigrationStatement } from '../base'

const TIMESTAMP_SQLITE = `STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')`

export class Migration extends MigrationStatement {
  static VERSION = '0.4.1' as const

  call() {
    this.db.exec(`
      DROP TRIGGER media_reference_tag_count_inc;
      DROP TRIGGER media_reference_tag_count_dec;

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
    `)
  }
}
