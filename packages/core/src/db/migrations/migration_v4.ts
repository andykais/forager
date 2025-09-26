import * as torm from '@torm/sqlite'
import { migrations, TIMESTAMP_COLUMN } from './registry.ts'
import path from "node:path";

const SCHEMAS = {
  media_file: torm.schema('media_file', {
    filepath: torm.field.string(),
    checksum: torm.field.string(),
    created_at: torm.field.datetime(),
  }),
  filesystem_path: torm.schema('filesystem_path', {
    filepath: torm.field.string(),
    filename: torm.field.string().optional(),
    directory: torm.field.boolean(),
    checksum: torm.field.string().optional(),
    last_ingest_id: torm.field.number().optional(),
    ingest_priority: torm.field.number().optional(),
    ingest_retriever: torm.field.string().optional(),
    ingested_at: torm.field.datetime().optional(),
  })
}


@migrations.register()
export class Migration extends torm.Migration {
  version = 4

  call = () => {
    this.driver.exec(`
      CREATE TABLE filesystem_path (
        id INTEGER PRIMARY KEY NOT NULL,
        filepath TEXT NOT NULL,
        directory INTEGER NOT NULL CHECK(directory IN (0, 1)),
        checksum TEXT, -- populated after a file is ingested into forager
        last_ingest_id INTEGER CHECK((directory = 0 AND last_ingest_id IS NOT NULL) OR last_ingest_id IS NULL),
        -- these fields are null for directories
        ingest_priority INTEGER CHECK((directory = 0 AND ingest_priority IS NOT NULL) OR ingest_priority IS NULL),
        filename TEXT CHECK((directory = 0 AND filename IS NOT NULL) OR filename IS NULL),
        ingest_retriever TEXT CHECK((directory = 0 AND ingest_retriever IS NOT NULL) OR ingest_retriever IS NULL),

        ingested_at TIMESTAMP DATETIME,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN}
      );
    `)
    this.driver.exec(`CREATE UNIQUE INDEX filesystem_path_lookup ON filesystem_path (filepath)`)
    this.driver.exec(`CREATE UNIQUE INDEX filesystem_path_priority ON filesystem_path (ingest_priority) WHERE directory = 0`)
    this.driver.exec(`CREATE INDEX filesystem_path_created_at ON filesystem_path (created_at, id)`)
    this.driver.exec(`CREATE INDEX filesystem_path_ingest_id ON filesystem_path (last_ingest_id)`)
    this.driver.exec(`CREATE INDEX filesystem_path_directory ON filesystem_path (directory)`)
    this.driver.exec(`DROP TABLE duplicate_log`)

    const insert_stmt = this.prepare`INSERT INTO filesystem_path (filepath, filename, directory, checksum, last_ingest_id, ingest_priority, ingest_retriever, ingested_at) VALUES (${[
      SCHEMAS.filesystem_path.params.filepath,
      SCHEMAS.filesystem_path.params.filename,
      SCHEMAS.filesystem_path.params.directory,
      SCHEMAS.filesystem_path.params.checksum,
      SCHEMAS.filesystem_path.params.last_ingest_id,
      SCHEMAS.filesystem_path.params.ingest_priority,
      SCHEMAS.filesystem_path.params.ingest_retriever,
      SCHEMAS.filesystem_path.params.ingested_at,
    ]})`

    const media_files = this.prepare`SELECT ${[
      SCHEMAS.media_file.result.filepath,
      SCHEMAS.media_file.result.checksum,
      SCHEMAS.media_file.result.created_at,
    ]} FROM media_file`.all()

    let ingest_priority = 1
    for (const media_file of media_files) {

      insert_stmt.exec({
        checksum: media_file.checksum,
        filepath: media_file.filepath,
        ingested_at: media_file.created_at,
        directory: false,
        last_ingest_id: null,
        ingest_priority: ingest_priority,
        ingest_retriever: 'unknown',
        filename: null,
      })

      // write folder paths
      let filepath = media_file.filepath
      while (true) {
        const paths = path.parse(filepath)
        try {
          insert_stmt.exec({
            checksum: null,
            filepath: paths.dir,
            ingested_at: media_file.created_at,
            directory: true,
            last_ingest_id: null,
            ingest_priority: null,
            ingest_retriever: null,
            filename: null,
          })
        } catch (e) {
          // ignore duplicate paths, this behaves like mkdir recursive
          if (e instanceof torm.errors.UniqueConstraintError) {
            break
          } else {
            throw e
          }
        }
        if (paths.root === paths.dir) {
          break
        }
        filepath = paths.dir
      }
      ingest_priority = ingest_priority + 1000
    }
    console.log('v4 migration complete')
  }
}
