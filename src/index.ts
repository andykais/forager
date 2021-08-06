import { Context } from './context'
import { MediaAction } from './actions/media'
import type { ContextConfig } from './context'

class Forager {
  private context = new Context(this.config)

  public constructor(public config: ContextConfig) {}

  public init() {
    this.context.init()
  }

  // available actions
  media = new MediaAction(this.context)
}

export { Forager }
