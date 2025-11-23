import * as torm from '@torm/sqlite'
import { migrations } from './registry.ts'


@migrations.register()
export class Migration extends torm.Migration {
  version = 8

  call = () => {
    console.log(`Adding media_series_name column`)
    this.driver.exec(`ALTER TABLE media_reference ADD COLUMN media_series_name TEXT`)

    console.log(`Adding unique index on media_reference.media_series_name when not null`)
    this.driver.exec(`CREATE UNIQUE INDEX media_series_name ON media_reference (media_series_name) WHERE media_series_name IS NOT NULL;`)

    console.log(`Adding unique index on media_series_item.{media_reference_id, series_index}`)
    this.driver.exec(`CREATE UNIQUE INDEX media_series_index ON media_series_item (media_reference_id, series_index)`)
  }
}
