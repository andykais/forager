import * as fs from '@std/fs'
import * as path from '@std/path'
import { Actions } from '~/actions/lib/base.ts'
import { inputs, parsers } from '~/inputs/mod.ts'
import * as plugin from '~/lib/plugin_script.ts'


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
          default_metadata: params.set, // NOTE we use the unparsed input here because our layer below here also parses media_info/tags
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
        const progress_index = index + 1
        const percent_complete = this.format_decimals((progress_index / queued_entries.length) * 100) + '%'
        return `Stats: progress: ${progress_index}/${queued_entries.length} (${percent_complete}), created: ${stats.created}, updated: ${stats.updated}, duplicates: ${stats.duplicate}, nooped: ${stats.existing}, errored: ${stats.errored}\n`
      })
    }

    const duration = performance.now() - start_time
    this.ctx.logger.info(`Created ${stats.created} media files and ignored ${stats.existing} existing and ${stats.duplicate} duplicate files in ${this.format_duration(duration)}.`)
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
