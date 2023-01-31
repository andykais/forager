import { torm } from '../deps.ts'
import { type Context } from '../context.ts'
import { MediaReference } from '../models/media_reference.ts'
import { TagGroup } from '../models/tag_group.ts'
import { Tag } from '../models/tag.ts'

class ForagerCore extends torm.Torm {
  static migrations = { version: '0.4.1' }

  public constructor(private context: Context) {
    super(context.config.database_path)
  }

  // model definitions
  media_reference = this.model(MediaReference)
  tag_group =       this.model(TagGroup)
  tag =             this.model(Tag)
}

export { ForagerCore }
