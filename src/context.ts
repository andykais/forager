import { Database } from './db/sqlite'
import { Logger } from './logger'
import type { LogLevel } from './logger'

interface ContextConfig {
  database_path: string

  log_level?: LogLevel
}

class Context {
  public db: Database
  public logger: Logger

  public constructor(public config: ContextConfig) {
    if (!this.config.database_path) throw new Error('database_path must be specified')
    this.logger = new Logger(this.config.log_level)
    this.db = new Database(this)
  }

  public init() {
    this.db.init()
  }
}

export { Context }
export type { ContextConfig }
