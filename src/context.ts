import type { ForagerConfig } from './mod.ts'
import { Logger } from './logger.ts'
import { Database } from './db/mod.ts'
import './migrations/mod.ts'


class Context {
  public config: ForagerConfig
  public logger: Logger
  public db: Database


  public constructor(config: ForagerConfig) {
    this.config = config
    this.logger = new Logger(this)
    this.db = new Database(this)
  }

  get models() {
    return this.db.models
  }
}

export { Context }
