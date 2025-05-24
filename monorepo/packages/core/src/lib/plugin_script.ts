import * as path from '@std/path'
import * as fs from '@std/fs'
import { Forager } from '~/mod.ts'
import * as errors from '~/lib/errors.ts'
import { inputs, outputs } from '~/inputs/mod.ts'
import { Logger } from "~/lib/logger.ts";
import { CODECS } from '~/lib/codecs.ts'

export interface FileSystemReceiverContext {
  default_metadata: inputs.FileSystemDiscover['set']
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
}

export abstract class FileSystemReceiver {
  public root?: string
  public extensions?: string[]
  public match?: string | RegExp

  public abstract foreach(ctx: FileSystemReceiverContext): Promise<void>

  protected async add(ctx: FileSystemReceiverContext, filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.TagList) {
    if (ctx.default_metadata?.media_info) {
      media_info = {...ctx.default_metadata.media_info, ...media_info}
    }
    if (ctx.default_metadata?.tags) {
      tags = ctx.default_metadata.tags.concat(tags ?? [] as inputs.TagList)
    }
    try {
      const existing_media = ctx.forager.media.get({filepath})
      if (media_info || tags) {
        // const media_file = this.models.MediaFile.select_one({filepath: e.filepath}, {or_raise: true})
        ctx.forager.media.update(existing_media.media_reference.id, media_info, tags)
        ctx.logger.info(`Updated existing file ${ctx.entry.path}`)
        ctx.stats.updated += 1
      } else {
        ctx.stats.existing ++
      }
      return
    } catch(e) {
      if (e instanceof errors.NotFoundError) {} // this is the normal flow for adding new media
      else throw e
    }
    try {
      await ctx.forager.media.create(filepath, media_info, tags)
      ctx.stats.created += 1
    } catch (e) {
      let file_identifier = filepath
      if (filepath !== ctx.entry.path) {
        file_identifier = `${filepath} from ${ctx.entry.path}`
      }

      if (e instanceof errors.DuplicateMediaError) {
        ctx.logger.warn(`${file_identifier} has a duplicate checksum (${e.checksum}) to ${e.existing_media_filepath}, skipping`)
        ctx.stats.duplicate += 1
      } else if (e instanceof errors.MediaAlreadyExistsError) {
        if (media_info || tags) {
          // this.ctx.logger.info(`${e.filepath} already exists in database, updating`)
          const {media_reference} = ctx.forager.media.get({filepath: e.filepath})
          // const media_file = this.models.MediaFile.select_one({filepath: e.filepath}, {or_raise: true})
          ctx.forager.media.update(media_reference.id, media_info, tags)
          ctx.stats.updated += 1
        } else {
          ctx.logger.info(`${e.filepath} already exists in database, skipping`)
        }
        ctx.stats.existing += 1
      } else if (e instanceof errors.InvalidFileError) {
        ctx.logger.warn(`${filepath} was an invalid file, skipping`)
        ctx.stats.errored ++
      } else {
        ctx.logger.error(`${file_identifier} import failed.`)
        // ctx.stats.errored ++
        throw e
      }
    }
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
      if ((!this.extensions.includes(path.extname(entry.path).substr(1)))) {
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
  override match = /.*/
  override extensions = [...CODECS.values()].flatMap(codec => codec.extensions)

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
