import { ForagerConfig } from './src/config.ts'
import { Context } from './src/context.ts'
import { MediaAction } from './src/actions/media.ts'


class Forager {
  private context: Context
  public config: ForagerConfig
  // available actions
  public media: MediaAction

  public constructor(config: ForagerConfig) {
    this.config = config
    this.context = new Context(this.config)
    this.media = new MediaAction(this.context)
  }

  public async init() {
    await this.context.init()
  }

  public async close() {
    this.context.close()
  }

//   // available actions
//   tag = new TagAction(this.context)
//   media = new MediaAction(this.context)
//   file = new FileAction(this.context)
//   thumbnail = new ThumbnailAction(this.context)
}

export { Forager }
