/**
  * @module
  *
  * This module is the main entrypoint for using the @forager/core tools
  *
  * @example
  * ```ts
  * import { Forager } from '@forager/core'
  *
  *
  * using forager = new Forager({
  *   database_path: 'forager.db',
  *   thumbnail_folder: '~/.local/share/forager_thumbnails',
  * })
  * forager.init()
  *
  *
  * // add media directly into the database
  * forager.media.create('movie.mp4', {title: 'Gone With The Wind', source_created_at: new Date('1939/12/15')}, ['genre:drama'])
  * // or pass in a glob to import a whole directory
  * forager.filesystem.discover({path: './downloads/*.mp4', set: {['genre:drama']}})
  * // search for media in the database
  * forager.media.search({tags: ['genre:drama']})
  * ```
  */

import { Context } from './context.ts'
import * as actions from './actions/mod.ts'
import { type inputs, parsers } from '~/inputs/mod.ts'

class Forager {
  public config: inputs.ForagerConfig
  public media: actions.MediaActions
  public series: actions.SeriesActions
  public filesystem: actions.FileSystemActions
  public keypoints: actions.KeypointActions
  public views: actions.ViewActions
  public tag: actions.TagActions
  #ctx: Context

  public constructor(config: inputs.ForagerConfig) {
    this.config = parsers.ForagerConfig.parse(config)
    this.#ctx = new Context(config)
    this.media = new actions.MediaActions(this.#ctx)
    this.series = new actions.SeriesActions(this.#ctx)
    this.filesystem = new actions.FileSystemActions(this.#ctx)
    this.keypoints = new actions.KeypointActions(this.#ctx)
    this.views = new actions.ViewActions(this.#ctx)
    this.tag = new actions.TagActions(this.#ctx)
  }

  public init() {
    this.#ctx.db.init()
  }

  public close() {
    console.log('closing database', this.#ctx.config.database_path)
    this.#ctx.db.close()
  }

  [Symbol.dispose]() {
    this.close()
  }
}

export { Forager }
export * as errors from './lib/errors.ts'
export type ForagerConfig = inputs.ForagerConfig
export type {MediaResponse, MediaFileResponse, MediaSeriesResponse, MediaGroupResponse} from './actions/lib/base.ts'
export type * from './actions/mod.ts'
export { type inputs }
export type * from '~/inputs/mod.ts'
export { parsers }
