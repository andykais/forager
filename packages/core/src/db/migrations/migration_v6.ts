import * as torm from '@torm/sqlite'
import { migrations, TIMESTAMP_COLUMN } from './registry.ts'


@migrations.register()
export class Migration extends torm.Migration {
  version = 6

  call = () => {
    this.driver.exec(`
      CREATE TRIGGER media_reference_view_count AFTER INSERT ON view BEGIN
        UPDATE media_reference SET view_count = view_count + 1 WHERE NEW.media_reference_id = media_reference.id;
      END;
    `)
  }
}
