import * as fs from '@std/fs'
import * as path from '@std/path'
import { Actions } from '~/actions/lib/base.ts'
import { inputs, parsers } from '~/inputs/mod.ts'
import * as plugin from '~/lib/plugin_script.ts'
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
      const extensions = new Set<string>()
      for (const receiver of this.ctx.plugin_script.recievers) {
        for (const extension of receiver.extensions ?? []) {
          extensions.add(extension)
        }
      }
      if (extensions.size) {
        walk_options.exts = [...extensions]
      }
    }

    let walk_path = parsed.params.path
    if (path.isGlob(parsed.params.path)) {
      walk_path = this.#find_globless_parent_dir(parsed.params.path)
      walk_options.match = [path.globToRegExp(parsed.params.path)]
    }

    const queued_entries: fs.WalkEntry[] = []
    this.ctx.logger.info(`Collecting files in ${walk_path}...`)
    for await (const entry of fs.walk(walk_path, walk_options)) {
      for (const receiver of this.ctx.plugin_script.recievers) {
        if (receiver.matches(entry)) {
          queued_entries.push(entry)
          break
        }
      }
    }
    this.ctx.logger.info(`Found ${queued_entries.length} files`)

    const stats: plugin.FileSystemReceiverContext['stats'] = {
      created: 0,
      updated: 0,
      existing: 0,
      duplicate: 0,
      errored: 0,
    }
    for (const [index, entry] of queued_entries.entries()) {
      const receiver = this.ctx.plugin_script.recievers.find(receiver => receiver.matches(entry))
      if (receiver === undefined) {
        throw new Error(`unexpected code path`)
      }

      try {
        await receiver.foreach({
          stats,
          entry,
          forager: this.ctx.forager,
          logger: this.ctx.logger,
        })
      } catch (e) {
        this.ctx.logger.error(e)
        throw e
      }
      this.ctx.logger.info(() => {
        const percent_complete = ((index/queued_entries.length) * 100).toFixed(2) + '%'
        return `Stats: progress: ${index}/${queued_entries.length} (${percent_complete}), created: ${stats.created}, updated: ${stats.updated}, duplicates: ${stats.duplicate}, nooped: ${stats.existing}, errored: ${stats.errored}\n`
      })
    }

//     if (Math.random() < 400) throw new Error(`HALTING`)

//     for await (const entry of fs.walk(walk_path, walk_options)) {
//       try {
//         await this.media_create(entry.path, parsed.params.set?.media_info, parsed.params.set?.tags)
//         stats.created += 1
//       } catch (e) {
//         if (e instanceof errors.DuplicateMediaError) {
//           this.ctx.logger.warn(`${e.filepath} has a duplicate checksum (${e.checksum}) to ${e.existing_media_filepath}, skipping`)
//           stats.duplicate += 1
//         } else if (e instanceof errors.MediaAlreadyExistsError) {
//           if (params.set?.media_info || params.set?.tags) {
//             this.ctx.logger.info(`${e.filepath} already exists in database, updating`)
//             const media_file = this.models.MediaFile.select_one({filepath: e.filepath}, {or_raise: true})
//             this.media_update(media_file.media_reference_id, params.set?.media_info, params.set?.tags)
//             stats.updated += 1
//           } else {
//             this.ctx.logger.info(`${e.filepath} already exists in database, skipping`)
//           }
//           stats.existing += 1
//         } else {
//           this.ctx.logger.error(`${entry.path} import failed.`)
//           throw e
//         }
//       }
//     }

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
