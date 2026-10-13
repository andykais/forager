import * as path from '@std/path'
import * as fs from '@std/fs'
import { Forager } from '~/mod.ts'
import { inputs } from '~/inputs/mod.ts'
import { Logger } from "~/lib/logger.ts";
import { CODECS } from '~/lib/codecs.ts'

export interface FileSystemReceiverContext {
  file_id: number
  receiver: FileSystemReceiver

  default_metadata: NonNullable<inputs.IngestStart>['set']

  stats: {
    created: number
    updated: number
    existing: number
    duplicate: number
    errored: number
  }
  entry: fs.WalkEntry
  forager: Forager
  logger: Logger
  add(ctx: FileSystemReceiverContext, filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.TagList, series?: inputs.MediaSeriesBulk, editing?: ReceiverEditing): Promise<void>
}

/**
 * Editing options for media added by a {@linkcode FileSystemReceiver}. These are passed through to media create/update calls as-is.
 * When omitted, no editing options are sent and the `editing` block from the forager config applies.
 */
export interface ReceiverEditing {
  /** Identifier of the editor, can be used to distinguish where a particular media metadata field or tag came from */
  editor?: string
  /** Overwrite edits of other editors when updating existing media. Set to false to only replace tags and fields previously written by this editor */
  overwrite?: boolean
}

export abstract class FileSystemReceiver {
  public abstract name: string
  public root?: string
  public extensions?: string[]
  public match?: string | RegExp

  public abstract foreach(ctx: FileSystemReceiverContext): Promise<void>

  protected async add(ctx: FileSystemReceiverContext, filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.TagList, series?: inputs.MediaSeriesBulk, editing?: ReceiverEditing) {
    return ctx.add(ctx, filepath, media_info, tags, series, editing)
  }

  /** @internal */
  public matches(entry: fs.WalkEntry) {
    if (this.root) {
      const relative_path = path.relative(this.root, entry.path)
      if (relative_path === "" || relative_path.startsWith("..") || relative_path.startsWith(path.SEPARATOR)) {
        return false
      }
    }
    if (this.extensions) {
      if ((!this.extensions.includes(path.extname(entry.path).substring(1).toLowerCase()))) {
        return false
      }
    }
    if (this.match) {
      if (typeof this.match === 'string') {
        if (!entry.path.includes(this.match)) {
          return false
        }
      } else {
        if (!this.match.test(entry.path)) {
          return false
        }
      }
    }

    return true
  }
}

class FileSystemReceiverDefault extends FileSystemReceiver {
  public override name = 'default'
  public override match = /.*/
  public override extensions = [...CODECS.values()].flatMap(codec => codec.extensions)

  public foreach: FileSystemReceiver['foreach'] = async ctx => {
    await this.add(ctx, ctx.entry.path)
  }
}

export class PluginScript {

  public recievers: FileSystemReceiver[]

  public constructor() {
    this.recievers = [new FileSystemReceiverDefault()]
  }
}
