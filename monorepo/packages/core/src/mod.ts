import { Context } from './context.ts'
import type { LogLevel } from '~/lib/logger.ts'
import * as actions from './actions/mod.ts'
import { type inputs, parsers } from '~/inputs/mod.ts'

class Forager {
  public config: inputs.ForagerConfig
  public media: actions.MediaActions
  public series: actions.SeriesActions
  public filesystem: actions.FileSystemActions
  public keypoints: actions.KeypointActions
  public views: actions.ViewActions
  #ctx: Context

  public constructor(config: inputs.ForagerConfig) {
    this.config = parsers.ForagerConfig.parse(config)
    this.#ctx = new Context(config)
    this.media = new actions.MediaActions(this.#ctx)
    this.series = new actions.SeriesActions(this.#ctx)
    this.filesystem = new actions.FileSystemActions(this.#ctx)
    this.keypoints = new actions.KeypointActions(this.#ctx)
    this.views = new actions.ViewActions(this.#ctx)
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
export type ForagerConfig = inputs.ForagerConfig
export { type inputs }
export { parsers }
