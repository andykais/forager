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
    this.db = new Database(this)
    this.logger = new Logger(this.config.log_level)
  }

  public init() {
    this.db.init()
  }
}

export { Context }
