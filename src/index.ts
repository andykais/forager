import { Context } from './context'
import { MediaAction } from './actions/media'
import { FileAction } from './actions/file'
import { ThumbnailAction } from './actions/thumbnail'
import { TagAction } from './actions/tag'
import type { ContextConfig } from './context'

class Forager {
  private context = new Context(this.config)

  public constructor(public config: ContextConfig) {}

  public async init() {
    await this.context.init()
  }

  // available actions
  tag = new TagAction(this.context)
  media = new MediaAction(this.context)
  file = new FileAction(this.context)
  thumbnail = new ThumbnailAction(this.context)
}

export { Forager }
export * from './util/errors'
