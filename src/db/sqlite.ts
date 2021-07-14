import Sqlite3 from 'better-sqlite3'
import { version } from '../../package.json'
import { Context } from '../context'
import { init_migration_map } from './migrations/index'
// import model definitions
import { TableManager } from './models/table_manager'


class Database {
  private db: Sqlite3.Database = new Sqlite3(this.context.config.database_path)
  public migration_map = init_migration_map(this.db)

  // model definitions
  public table_manager = new TableManager(this.db)


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
    this.table_manager.init()
  }

  public wipe() {}

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
}


export { Database }
