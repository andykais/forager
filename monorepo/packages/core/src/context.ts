import type { ForagerConfig } from './mod.ts'
import { Logger } from '~/lib/logger.ts'
import { Database } from '~/db/mod.ts'


class Context {
  public config: ForagerConfig
  public logger: Logger
  public db: Database


  public constructor(config: ForagerConfig) {
    this.config = config
    this.logger = new Logger('forager.core', this.config.log_level)
    this.db = new Database(this)
  }
}

export { Context }
