import * as torm from '@torm/sqlite'
import { migrations } from './registry.ts'


@migrations.register()
export class Migration extends torm.Migration {
  version = 2

  call = () => {
    const all_count = this.driver.prepare(`SELECT COUNT() as total FROM media_reference`).get()
    const directory_reference_counts = this.driver.prepare(`SELECT COUNT() as total FROM media_reference WHERE directory_reference = 1`).get()
    console.log(`Cleaning up ${directory_reference_counts.total} media reference directories out of ${all_count.total} media references`)
    const media_reference_directories_stmt = this.driver.prepare(`SELECT id FROM media_reference WHERE directory_reference = 1`)
    // this.driver.exec(`DELETE FROM media_series_item`)
    const media_series_item_delete_stmt = this.driver.prepare(`DELETE FROM media_series_item WHERE series_id = :media_reference_id`)
    const media_reference_delete_stmt = this.driver.prepare(`DELETE FROM media_reference WHERE id = :id`)
    for (const media_reference of media_reference_directories_stmt.all()) {
      media_series_item_delete_stmt.run({media_reference_id: media_reference.id})
      media_reference_delete_stmt.run({id: media_reference.id})
    }
    console.log(`Record cleanup complete. Deleting related columns and indexes`)
    this.driver.exec(`DROP INDEX media_reference_directory_path`)
    this.driver.exec(`DROP INDEX directory_media_series_item`)
    this.driver.exec(`ALTER TABLE media_reference DROP COLUMN directory_path`)
    this.driver.exec(`ALTER TABLE media_reference DROP COLUMN directory_reference`)
    this.driver.exec(`ALTER TABLE media_reference DROP COLUMN directory_root`)
    this.driver.exec(`ALTER TABLE media_series_item DROP COLUMN filesystem_reference`)
    console.log(`v2 migration complete.`)
  }
}
