import { MigrationStatement } from '../base'

export class Migration extends MigrationStatement {
  static VERSION = '0.3.0' as const

  call() {
    this.db.exec(`
      ALTER TABLE tag ADD COLUMN unread_media_reference_count INTEGER NOT NULL DEFAULT 0;

      DROP TRIGGER media_reference_tag_count_inc;
      DROP TRIGGER media_reference_tag_count_dec;

      CREATE TRIGGER media_reference_tag_count_inc AFTER INSERT ON media_reference_tag BEGIN
        UPDATE media_reference SET tag_count = tag_count + 1 WHERE NEW.media_reference_id = id;
        UPDATE tag SET
          media_reference_count = media_reference_count + 1,
          unread_media_reference_count = unread_media_reference_count + (SELECT view_count = 0 FROM media_reference WHERE media_reference.id = NEW.media_reference_id)
        WHERE NEW.tag_id = id;
      END;

      CREATE TRIGGER media_reference_tag_count_dec AFTER DELETE ON media_reference_tag BEGIN
        UPDATE media_reference SET tag_count = tag_count - 1 WHERE OLD.media_reference_id = id;
        UPDATE tag SET
          media_reference_count = media_reference_count - 1,
          unread_media_reference_count = unread_media_reference_count - (SELECT view_count = 0 FROM media_reference WHERE media_reference.id = OLD.media_reference_id)
        WHERE OLD.tag_id = id;
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
    `)
    const update_tag_unread_media_count = this.db.prepare(`
      UPDATE tag
        SET unread_media_reference_count = :unread_count
      WHERE tag.id = :tag_id
    `)
    const count_unread_media_reference_where_tag = this.db.prepare(`
      SELECT COUNT(*) as unread_count FROM media_reference
      INNER JOIN media_reference_tag ON media_reference.id = media_reference_id
      WHERE view_count = 0 AND tag_id = :tag_id
    `)
    const { tag_count } = this.db.prepare('SELECT COUNT(*) as tag_count FROM tag').get()
    const tag_ids = this.db.prepare('SELECT id FROM tag').all()
    for (const index of tag_ids.keys()) {
      const tag_id = tag_ids[index].id
      const { unread_count } = count_unread_media_reference_where_tag.get({ tag_id })
      const info = update_tag_unread_media_count.run({ tag_id, unread_count })
      if (info.changes !== 1) throw new Error(`unexpected number of changes for tag id ${tag_id}`)
      process.stdout.write(`\rmigrated ${index + 1}/${tag_count} tags (last tag had ${unread_count} unread media)`)
    }
    console.log('')
  }
}
