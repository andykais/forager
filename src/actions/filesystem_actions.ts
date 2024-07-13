import * as fs from '@std/fs'
import * as path from '@std/path'
import { Actions } from '~/actions/lib/base.ts'
import { inputs, parsers } from '~/inputs/mod.ts'
import { CODECS } from '~/lib/codecs.ts'
import * as errors from '~/lib/errors.ts'
import * as result_types from '~/models/lib/result_types.ts'


class FileSystemActions extends Actions {
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
      existing: 0,
      duplicate: 0,
    }
    for await (const entry of fs.walk(walk_path, walk_options)) {
      try {
        const {media_file, media_reference} = await this.media_create(entry.path)
        stats.created += 1
      } catch (e) {
        if (e instanceof errors.DuplicateMediaError) {
          stats.duplicate += 1
        } else if (e instanceof errors.MediaAlreadyExistsError) {
          stats.existing += 1
        } else {
          throw e
        }
      }
    }

    const duration = (performance.now() - start_time) / 1000
    this.ctx.logger.info(`Created ${stats.created} media files and ignored ${stats.existing} existing and ${stats.duplicate} duplicate files.`)
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
