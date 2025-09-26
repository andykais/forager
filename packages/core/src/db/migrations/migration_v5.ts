import * as torm from '@torm/sqlite'
import { migrations, TIMESTAMP_COLUMN } from './registry.ts'


@migrations.register()
export class Migration extends torm.Migration {
  version = 5

  call = () => {
    this.driver.exec(`
      CREATE TABLE filesystem_path__migrated (
        id INTEGER PRIMARY KEY NOT NULL,
        filepath TEXT NOT NULL,
        directory INTEGER NOT NULL CHECK(directory IN (0, 1)),
        checksum TEXT, -- populated after a file is ingested into forager
        -- these fields are null for directories
        ingested BOOLEAN NOT NULL,
        ingest_priority INTEGER CHECK((directory = 0 AND ingest_priority IS NOT NULL) OR ingest_priority IS NULL),
        filename TEXT CHECK((directory = 0 AND filename IS NOT NULL) OR filename IS NULL),
        ingest_retriever TEXT CHECK((directory = 0 AND ingest_retriever IS NOT NULL) OR ingest_retriever IS NULL),

        ingested_at TIMESTAMP DATETIME,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN}
      );
    `)

    this.driver.exec(`
      INSERT INTO filesystem_path__migrated (
        id,
        filepath,
        directory,
        checksum,
        ingest_priority,
        filename,
        ingest_retriever,
        ingested_at,
        updated_at,
        created_at,
        ingested
      )
      SELECT
        id,
        filepath,
        directory,
        checksum,
        ingest_priority,
        filename,
        ingest_retriever,
        ingested_at,
        updated_at,
        created_at,
        FALSE
      FROM filesystem_path__migrated
    `)

    this.driver.exec(`DROP TABLE filesystem_path`)
    this.driver.exec(`ALTER TABLE filesystem_path__migrated RENAME TO filesystem_path`)

    // recreate the indexes associated with the original table
    this.driver.exec(`
      CREATE UNIQUE INDEX filesystem_path_lookup ON filesystem_path (filepath);
      CREATE UNIQUE INDEX filesystem_path_priority ON filesystem_path (ingest_priority) WHERE directory = 0;
      CREATE INDEX filesystem_path_created_at ON filesystem_path (created_at, id);
      CREATE INDEX filesystem_path_ingested ON filesystem_path (ingested);
      CREATE INDEX filesystem_path_directory ON filesystem_path (directory);
    `)
  }
}
