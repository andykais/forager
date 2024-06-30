import { Context } from './context.ts'
import type { LogLevel } from './logger.ts'
import {
  MediaAction
} from './actions/mod.ts'


interface ForagerConfig {
  database_path: string
  log_level?: LogLevel
}

class Forager {
  public config: ForagerConfig
  public media: MediaAction
  #ctx: Context

  public constructor(config: ForagerConfig) {
    this.config = config
    this.#ctx = new Context(config)
    this.media = new MediaAction(this.#ctx)
  }

  public init() {
    this.#ctx.db.init()
  }
}

export { Forager }
export type { ForagerConfig }
