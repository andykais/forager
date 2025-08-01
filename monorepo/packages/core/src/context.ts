import * as torm from '@torm/sqlite'
import { outputs } from '~/inputs/mod.ts'
import { Logger } from '~/lib/logger.ts'
import { Database, type DatabaseInfo } from '~/db/mod.ts'
import { PluginScript } from "~/lib/plugin_script.ts";
import type { Forager } from '~/mod.ts'

export interface ContextInitInfo {
  db: torm.InitInfo
  schemas: DatabaseInfo
}

class Context {
  public config: outputs.ForagerConfig
  public logger: Logger
  public db: Database
  public plugin_script: PluginScript
  public forager: Forager


  public constructor(config: outputs.ForagerConfig, plugin_script: PluginScript, forager: Forager) {
    this.config = config
    this.forager = forager
    this.logger = new Logger('forager.core', this.config.logger.level)
    this.db = new Database(this)
    this.plugin_script = plugin_script
  }

  public init(): ContextInitInfo {
    this.logger.info(`Connecting to sqlite database ${this.db.sqlite_path}`)
    const db_init_info = this.db.init()
    const db_info = this.db.info()
    return {
      db: db_init_info,
      schemas: db_info,
    }
  }
}

export { Context }
