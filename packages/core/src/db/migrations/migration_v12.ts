import * as torm from '@torm/sqlite'
import { migrations, TIMESTAMP_COLUMN } from './registry.ts'


@migrations.register()
export class Migration extends torm.Migration {
  version = 12

  call = () => {
    console.log(`Adding md5checksum column to media_file table`)
    this.driver.exec(`ALTER TABLE media_file ADD COLUMN md5checksum TEXT`)
    this.driver.exec(`CREATE INDEX media_file_md5checksum ON media_file (md5checksum)`)

    // sqlite indexes and tables share a namespace, so the old media_file filepath index needs a new name
    this.driver.exec(`DROP INDEX media_filepath`)
    this.driver.exec(`CREATE UNIQUE INDEX media_file_filepath ON media_file (filepath)`)

    console.log(`Creating media_filepath table`)
    this.driver.exec(`
      CREATE TABLE media_filepath (
        id INTEGER PRIMARY KEY NOT NULL,
        media_file_id INTEGER NOT NULL,
        filepath TEXT NOT NULL,
        filename TEXT NOT NULL,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},

        FOREIGN KEY (media_file_id) REFERENCES media_file(id)
      )
    `)
    this.driver.exec(`
      INSERT INTO media_filepath (media_file_id, filepath, filename, updated_at, created_at)
      SELECT id, filepath, filename, created_at, created_at
      FROM media_file
      ORDER BY id
    `)
    this.driver.exec(`CREATE UNIQUE INDEX media_filepath_lookup ON media_filepath (filepath)`)
    this.driver.exec(`CREATE INDEX media_filepath_media_file ON media_filepath (media_file_id)`)
  }
}
