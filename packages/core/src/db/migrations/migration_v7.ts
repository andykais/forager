import * as torm from '@torm/sqlite'
import { migrations, TIMESTAMP_COLUMN_OPTIONAL } from './registry.ts'


@migrations.register()
export class Migration extends torm.Migration {
  version = 7

  call = () => {
    console.log(`Adding last_viewed_at column (w/ no default timestamp)`)
    this.driver.exec(`ALTER TABLE media_reference ADD COLUMN last_viewed_at__migration ${TIMESTAMP_COLUMN_OPTIONAL}`)
    console.log('Correcting media reference last_viewed_at under temporary column last_viewed_at__migration')
    this.driver.exec(`UPDATE media_reference
      SET last_viewed_at__migration = CASE
        WHEN view_count = 0 THEN NULL
        ELSE last_viewed_at
      END`)

    console.log(`Dropping old last_viewed_at column`)
    this.driver.exec(`ALTER TABLE media_reference DROP COLUMN last_viewed_at`)
    console.log(`Renaming temporary last_viewed_at__migration column to last_viewed_at`)
    this.driver.exec(`ALTER TABLE media_reference RENAME COLUMN last_viewed_at__migration TO last_viewed_at`)
  }
}
