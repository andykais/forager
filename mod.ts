import { ForagerConfig } from './src/config.ts'
import { Context } from './src/context.ts'


class Forager {
  public config: ForagerConfig
  private context: Context

  public constructor(config: ForagerConfig) {
    this.config = config
    this.context = new Context(this.config)
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
