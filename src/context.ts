import { ForagerCore } from './database/core.ts'
import { ForagerConfig, ForagerConfigInput } from './config.ts'
import { Logger, type LogLevel } from './logger.ts'

type Literal = boolean | null | number | string;
export type Json = Literal | { [key: string]: Json } | Json[];

class Context {
  public db: ForagerCore
  public config: ForagerConfig
  public logger: Logger

  public constructor(config: ForagerConfig) {
    this.config = config
    // if (!this.config.database_path) throw new Error('database_path must be specified')
    this.logger = new Logger(this.config.log_level)
    this.db = new ForagerCore(this)
  }

  public async init() {
    await this.db.init()
  }

  public async close() {
    this.db.close()
  }
}

export { Context }
