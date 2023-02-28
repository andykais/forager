import { SqliteError } from 'https://deno.land/x/sqlite_native@1.0.5/mod.ts'
import { torm } from '../deps.ts'
import { type Context } from '../context.ts'
import { MediaReference } from '../models/media_reference.ts'
import { MediaFile } from '../models/media_file.ts'
import { TagGroup } from '../models/tag_group.ts'
import { Tag } from '../models/tag.ts'

class ForagerCore extends torm.Torm {
  static migrations = { version: '0.4.1' }

  public constructor(private context: Context) {
    super(context.config.database_path)
  }

  // model definitions
  media_reference = this.model(MediaReference)
  media_file      = this.model(MediaFile)
  tag_group =       this.model(TagGroup)
  tag =             this.model(Tag)


  // TODO handle this better in a driver?
  is_unique_constaint_error(e: Error) {
    return e instanceof SqliteError && e.code === 2067
  }
}

export { ForagerCore }
