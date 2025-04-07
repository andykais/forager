import { outputs } from '~/inputs/mod.ts'
import { Logger } from '~/lib/logger.ts'
import { Database } from '~/db/mod.ts'


class Context {
  public config: outputs.ForagerConfig
  public logger: Logger
  public db: Database


  public constructor(config: outputs.ForagerConfig) {
    this.config = config
    this.logger = new Logger('forager.core', this.config.log_level)
    this.db = new Database(this)
  }
}

export { Context }
