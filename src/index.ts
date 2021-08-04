import { Context } from './context'
import { MediaFileAction } from './actions/media_file'
import type { ContextConfig } from './context'

class Forager {
  private context = new Context(this.config)

  public constructor(public config: ContextConfig) {}

  public init() {
    this.context.init()
  }

  // available actions
  media_file = new MediaFileAction(this.context)
}

export { Forager }
