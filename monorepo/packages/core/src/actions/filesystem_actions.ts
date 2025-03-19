import * as fs from '@std/fs'
import * as path from '@std/path'
import { Actions } from '~/actions/lib/base.ts'
import { inputs, parsers } from '~/inputs/mod.ts'
import { CODECS } from '~/lib/codecs.ts'
import * as errors from '~/lib/errors.ts'
import * as fmt_duration from '@std/fmt/duration'


/**
  * Actions associated with interacting with the file system
  */
class FileSystemActions extends Actions {

  /**
    * Used to walk files within a directory that will populate themselves into forager.
    */
  discover = async (params: inputs.FileSystemDiscover) => {
    const start_time = performance.now()
    const parsed = {
      params: parsers.FileSystemDiscover.parse(params)
    }

    const walk_options: fs.WalkOptions = { includeDirs: false, includeSymlinks: false }
    if (params.extensions) {
      walk_options.exts = parsed.params.extensions
    } else {
      const default_accepted_extensions = [...CODECS.values()].flatMap(codec => codec.extensions)
      walk_options.exts = default_accepted_extensions
    }

    let walk_path = parsed.params.path
    if (path.isGlob(parsed.params.path)) {
      walk_path = this.#find_globless_parent_dir(parsed.params.path)
      walk_options.match = [path.globToRegExp(parsed.params.path)]
    }

    let stats = {
      created: 0,
      updated: 0,
      existing: 0,
      duplicate: 0,
    }
    for await (const entry of fs.walk(walk_path, walk_options)) {
      try {
        await this.media_create(entry.path, parsed.params.set?.media_info, parsed.params.set?.tags)
        stats.created += 1
      } catch (e) {
        if (e instanceof errors.DuplicateMediaError) {
          this.ctx.logger.warn(`${e.filepath} has a duplicate checksum (${e.checksum}) to ${e.existing_media_filepath}, skipping`)
          stats.duplicate += 1
        } else if (e instanceof errors.MediaAlreadyExistsError) {
          if (params.set?.media_info || params.set?.tags) {
            this.ctx.logger.info(`${e.filepath} already exists in database, updating`)
            const media_reference = this.models.MediaFile.select_one({filepath: e.filepath}, {or_raise: true})
            this.media_update(media_reference.id, params.set?.media_info, params.set?.tags)
            stats.updated += 1
          } else {
            this.ctx.logger.info(`${e.filepath} already exists in database, skipping`)
          }
          stats.existing += 1
        } else {
          this.ctx.logger.error(`${entry.path} import failed.`)
          throw e
        }
      }
    }

    const duration = performance.now() - start_time
    this.ctx.logger.info(`Created ${stats.created} media files and ignored ${stats.existing} existing and ${stats.duplicate} duplicate files in ${fmt_duration.format(duration, {ignoreZero: true})}.`)
    return { stats }
  }

  #find_globless_parent_dir(globpath: string): string {
    if (!path.isGlob(globpath)) {
      return globpath
    }

    const parsed_path = path.parse(globpath)
    if (parsed_path.dir === globpath) {
      throw new Error('could not find globless parent dir')
    }
    return this.#find_globless_parent_dir(parsed_path.dir)
  }
}


export { FileSystemActions }
