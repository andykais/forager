import { torm } from '../deps.ts'
import { type Context } from '../context.ts'
import { MediaReference } from '../models/media_reference.ts'

class ForagerCore extends torm.Torm {
  public constructor(private context: Context) {
    super(context.config.database_path)
  }

  // model definitions
  media_reference = this.model(MediaReference)
}

export { ForagerCore }
