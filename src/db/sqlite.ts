import { version } from '../../package.json'
import Sqlite3 from 'better-sqlite3'
import { Context } from '../context'
import { init_migrations } from './migrations/index'
import type { Model, MigrationStatement } from './base'
// import model definitions
import { TableManager } from '../models/table_manager'
import { MediaChunk } from '../models/media_chunk'
import { MediaFile } from '../models/media_file'
import { MediaThumbnail } from '../models/media_thumbnail'
import { MediaReference } from '../models/media_reference'
import { MediaReferenceTag } from '../models/media_reference_tag'
import { TagGroup } from '../models/tag_group'
import { Tag } from '../models/tag'
import { DuplicateLog } from '../models/duplicate_logs'


class Database {
  public db: Sqlite3.Database = new Sqlite3(this.context.config.database_path)
  private registered_models: Model[] = []
  public migrations =  init_migrations(this.db)

  // model definitions
  public table_manager = this.register(TableManager)
  public media_chunk = this.register(MediaChunk)
  public media_file = this.register(MediaFile)
  public media_thumbnail = this.register(MediaThumbnail)
  public media_reference = this.register(MediaReference)
  public media_reference_tag = this.register(MediaReferenceTag)
  public tag_group = this.register(TagGroup)
  public tag = this.register(Tag)
  public duplicate_log = this.register(DuplicateLog)


  public constructor(private context: Context) {
    this.context.logger.debug('opened database at', this.context.config.database_path)
  }

  public async init() {
    this.db.pragma('journal_mode = WAL')
    if (this.table_manager.tables_exist()) {
      await this.migrate()
    } else {
      this.db.transaction(() => {
        this.context.logger.info('initializing database...')
        this.table_manager.create_tables()
        this.table_manager.set_forager_metadata(version)
        this.context.logger.info(`new database initialized. (version ${version})`)
      })()
    }
    for (const model of this.registered_models) {
      model.init()
    }
  }

  public wipe() {
    throw new Error('unimplemented')
  }

  public async migrate() {
    for (const { migration, version, foreign_keys } of this.migrations) {
      const current_version = this.table_manager.get_forager_metadata().version

      if (version > current_version) {
        this.context.logger.info(`migrating ${current_version} to ${version}`)
        try {
          if (foreign_keys === false) this.db.pragma('foreign_keys = OFF')
          await this.transaction_async(async () => {
            await migration.call()
            this.table_manager.set_forager_metadata(version)
          })()
        } catch (e) {
          throw new Error(`Database migration failed going from ${current_version} to ${version}\n${e}`)
        } finally {
          if (foreign_keys === false) this.db.pragma('foreign_keys = ON')
        }
      }
    }
    this.context.logger.info(`database is up to date. (version ${this.table_manager.get_forager_metadata().version})`)
  }

  private register<T extends Model>(model_class: new (db: Sqlite3.Database) => T) {
    const model = new model_class(this.db)
    this.registered_models.push(model)
    return model
  }

  public transaction_async = <T>(fn: () => Promise<T>) => async () => {
    try {
      this.db.exec('BEGIN TRANSACTION')
      const result = await fn()
      this.db.exec('COMMIT')
      return result
    } catch(e) {
      this.db.exec('ROLLBACK')
      throw e
    }
  }
}


export { Database }
