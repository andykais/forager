import { Context } from './context.ts'
import type { LogLevel } from '~/lib/logger.ts'
import * as actions from './actions/mod.ts'


interface ForagerConfig {
  database_path: string
  thumbnail_folder: string
  log_level?: LogLevel
  // allow_multiprocess_read_access?: boolean
}

class Forager {
  public config: ForagerConfig
  public media: actions.MediaActions
  public series: actions.SeriesActions
  public filesystem: actions.FileSystemActions
  #ctx: Context

  public constructor(config: ForagerConfig) {
    this.config = config
    this.#ctx = new Context(config)
    this.media = new actions.MediaActions(this.#ctx)
    this.series = new actions.SeriesActions(this.#ctx)
    this.filesystem = new actions.FileSystemActions(this.#ctx)
  }

  public init() {
    this.#ctx.db.init()
  }

  public close() {
    this.#ctx.db.close()
  }

  [Symbol.dispose]() {
    this.close()
  }
}

export { Forager }
export * as errors from './lib/errors.ts'
export type { ForagerConfig }
