import * as torm from '@torm/sqlite'
import { migrations, TIMESTAMP_COLUMN } from './registry.ts'


@migrations.register()
export class Migration extends torm.Migration {
  version = 3

  call = () => {
    console.log(`Adding column 'editors' to media_reference table`)
    this.driver.exec(`ALTER TABLE media_reference ADD COLUMN editors JSON`)

    console.log(`Adding column 'editor' to media_reference_tag table`)
    this.driver.exec(`ALTER TABLE media_reference_tag ADD COLUMN editor TEXT`)

    console.log(`Creating edit_log table`)
    this.driver.exec(`
      CREATE TABLE edit_log (
        id INTEGER PRIMARY KEY NOT NULL,
        media_reference_id INTEGER NOT NULL,
        editor TEXT NOT NULL,
        operation_type TEXT NOT NULL CHECK( operation_type IN ('CREATE', 'UPDATE') ),
        -- JSON schema for media info and tag changes: {"media_info": {"title": "new title", "description": "new desc", ...}, "tags": {"added": ["group1:tag1", "group2:tag2"], "removed": ["group1:tag3"]}}
        changes JSON NOT NULL,
        created_at ${TIMESTAMP_COLUMN},
        FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
      );
    `)
    console.log(`Creating edit_log index`)
    this.driver.exec(`CREATE INDEX media_reference_edit_log ON edit_log (media_reference_id, created_at);`)
    console.log(`v3 migration complete`)
  }
}
