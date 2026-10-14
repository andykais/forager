import * as torm from '@torm/sqlite'
import { migrations, MEDIA_REFERENCE_FTS_SQL } from './registry.ts'


@migrations.register()
export class Migration extends torm.Migration {
  version = 12

  call = () => {
    console.log(`Creating the media_reference_fts full text search index`)
    this.driver.exec(MEDIA_REFERENCE_FTS_SQL)

    console.log(`Backfilling media_reference_fts from existing media references`)
    this.driver.exec(`
      INSERT INTO media_reference_fts (rowid, title, description, metadata, filepath)
      SELECT
        media_reference.id,
        media_reference.title,
        media_reference.description,
        media_reference.metadata,
        (SELECT media_file.filepath FROM media_file WHERE media_file.media_reference_id = media_reference.id)
      FROM media_reference
    `)
  }
}
