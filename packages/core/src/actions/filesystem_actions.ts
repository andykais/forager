import * as fs from '@std/fs'
import * as path from '@std/path'
import { Actions } from '~/actions/lib/base.ts'
import * as torm from '@torm/sqlite'
import { inputs, parsers } from '~/inputs/mod.ts'
import * as plugin from '~/lib/plugin_script.ts'
import { FilesystemPath } from '~/models/filesystem_path.ts'

interface FileSystemDiscoverStats {
  created: {
    directories: number
    files: number
  }
  existing: {
    directories: number
    files: number
  }
  ignored: {
    files: number
  }
}
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

    const stats: FileSystemDiscoverStats = {
      created: { directories: 0, files: 0 },
      existing: { directories: 0, files: 0 },
      ignored: { files: 0 }
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
        walk_options.exts = [...extensions].flatMap(extension => [extension, extension.toUpperCase()]) // note that this is to handle .mp4 and .MP4 extensions
      }
    }

    let walk_path = parsed.params.path
    if (this.#is_glob(parsed.params.path)) {
      walk_path = this.#find_globless_parent_dir(parsed.params.path)
      walk_options.match = [path.globToRegExp(parsed.params.path)]
    }

    this.ctx.logger.info(`Collecting files in ${walk_path}...`)

    // Resolve the starting ingest_priority once for the whole discovery pass.
    // Previously the model's INSERT did this lookup via a
    // `(SELECT MAX(ingest_priority) ...)` subquery on every row, which made
    // `filesystem.discover` quadratic in the size of the table. Within a
    // single discover() run we are the only writer, so we can safely hand out
    // priorities by simple in-memory increment.
    const initial_max_priority = this.models.FilesystemPath.select_max_priority() ?? 0
    let next_file_priority = initial_max_priority + FilesystemPath.PRIORITY_SPACER

    let progress = 0
    for await (const entry of fs.walk(walk_path, walk_options)) {
      const receiver = this.ctx.plugin_script.recievers.find(receiver => receiver.matches(entry))
      if (receiver) {
        const created = this.#add_filepath(stats, receiver, entry, parsed.params.reingest, next_file_priority)
        if (created) {
          next_file_priority += FilesystemPath.PRIORITY_SPACER
        }
      } else {
        stats.ignored.files ++
      }
      if (progress % 100 === 0) {
        this.ctx.logger.info(`Discovered ${stats.created.files} new files, ${stats.existing.files} existing files, ignored ${stats.ignored.files} files.`)
      }
      progress ++
    }

    const duration = performance.now() - start_time
    this.ctx.logger.info(`Found ${stats.created.files} new files in ${this.format_duration(duration)}.`)
    return { stats }
  }

  #add_filepath(
    stats: FileSystemDiscoverStats,
    receiver: plugin.FileSystemReceiver,
    entry: fs.WalkEntry,
    reingest: boolean,
    ingest_priority: number,
  ): boolean {
      const filesystem_path_data = {
        directory: false,
        filepath: entry.path,
        ingest_priority,
        ingested: false,
        ingest_retriever: receiver.name,
        ingested_at: null,
        checksum: null,
        filename: entry.name,
      }

      const filesystem_path = this.models.FilesystemPath.select_one({filepath: filesystem_path_data.filepath})
      if (filesystem_path) {
          this.models.FilesystemPath.update({
            id: filesystem_path.id,
            ingest_retriever: filesystem_path_data.ingest_retriever,
            ingested: reingest ? false : filesystem_path.ingested,
            updated_at: new Date(),
          })
          stats.existing.files ++
          return false
      }

      try {
        this.models.FilesystemPath.create(filesystem_path_data)
        stats.created.files ++
        this.#add_directories(stats, path.dirname(entry.path))
        return true
      } catch (e) {
        if (e instanceof torm.errors.UniqueConstraintError) {
          // this is just being defensive against potential concurrency conflicts that shouldn't arise
          stats.existing.files ++
          const filesystem_path = this.models.FilesystemPath.select_one({filepath: e.params.filepath}, {or_raise: true})
          this.models.FilesystemPath.update({
            id: filesystem_path.id,
            ingested: reingest ? false : filesystem_path.ingested,
            ingest_retriever: filesystem_path_data.ingest_retriever,
            updated_at: new Date(),
          })
          return false
        }
        throw e
      }
  }

  #add_directories(stats: FileSystemDiscoverStats, filepath: string) {
    try {
      this.models.FilesystemPath.create({
        directory: true,
        filepath: filepath,
        ingest_priority: null,
        ingested: false,
        ingest_retriever: null,
        ingested_at: null,
        checksum: null,
        filename: null,
      })
      stats.created.directories ++
      const parent_path = path.dirname(filepath)
      if (parent_path !== filepath) {
        this.#add_directories(stats, parent_path)
      }
    } catch (e) {
      if (e instanceof torm.errors.UniqueConstraintError) {
        stats.existing.directories ++
      } else {
        throw e
      }
    }
  }

  #is_glob(globpath: string): boolean {
    if (!path.isGlob(globpath)) {
      return false
    }
    if (globpath.includes('?') && !globpath.includes('*')) {
      // make sure that paths that just contain "?" (like those common from downloading a query param url)
      // don't get treated like glob paths
      return false
    }

    return true
  }

  #find_globless_parent_dir(globpath: string): string {
    if (!this.#is_glob(globpath)) {
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
