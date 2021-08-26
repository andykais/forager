import { Context } from './context'
import { MediaAction } from './actions/media'
import { TagAction } from './actions/tag'
import type { ContextConfig } from './context'

class Forager {
  private context = new Context(this.config)

  public constructor(public config: ContextConfig) {}

  public init() {
    this.context.init()
  }

  // available actions
  media = new MediaAction(this.context)
  tag = new TagAction(this.context)
}

export { Forager }
export * from './util/errors'
