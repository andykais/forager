import Sqlite3 from 'better-sqlite3'
import { version } from '../../package.json'
import { Context } from '../context'
import { init_migration_map } from './migrations/index'
import type { Model } from './base'
// import model definitions
import { TableManager } from '../models/table_manager'
import { MediaFile } from '../models/media_file'
import { MediaReference } from '../models/media_reference'


class Database {
  private db: Sqlite3.Database = new Sqlite3(this.context.config.database_path)
  private registered_models: Model[] = []
  public migration_map = init_migration_map(this.db)

  // model definitions
  public table_manager = this.register(TableManager)
  public media_file = this.register(MediaFile)
  public media_reference = this.register(MediaReference)


  public constructor(private context: Context) {}

  public init() {
    if (this.table_manager.tables_exist()) {
      this.context.logger.info('migrating database...')
      this.migrate()
    } else {
      this.db.transaction(() => {
        this.context.logger.info('initializing database...')
        this.table_manager.create_tables()
        this.table_manager.set_forager_metadata(version)
        this.context.logger.info('new database initialized.')
      })()
    }
    for (const model of this.registered_models) {
      model.init()
    }
  }

  public wipe() {
    throw new Error('unimplemented')
  }

  public migrate() {
    const migration_versions = [...this.migration_map.keys()].sort((a, b) => a.localeCompare(b))

    for (const version of migration_versions) {
      const current_version = this.table_manager.get_forager_metadata().version

      if (version > current_version) {
        try {
          this.db.transaction(() => {
            const migration = this.migration_map.get(version)
            migration!.call()
            this.table_manager.set_forager_metadata(version)
          })()
        } catch (e) {
          throw new Error(`Database migration failed going from ${current_version} to ${version}\n${e}`)
        }
      }
    }
  }

  private register<T extends Model>(model_class: new (db: Sqlite3.Database) => T) {
    const model = new model_class(this.db)
    this.registered_models.push(model)
    return model
  }
}


export { Database }
