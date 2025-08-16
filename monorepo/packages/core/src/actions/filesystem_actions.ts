import * as fs from '@std/fs'
import * as path from '@std/path'
import { Actions } from '~/actions/lib/base.ts'
import * as torm from '@torm/sqlite'
import { inputs, parsers } from '~/inputs/mod.ts'
import * as plugin from '~/lib/plugin_script.ts'

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
        walk_options.exts = [...extensions]
      }
    }

    let walk_path = parsed.params.path
    if (this.#is_glob(parsed.params.path)) {
      walk_path = this.#find_globless_parent_dir(parsed.params.path)
      walk_options.match = [path.globToRegExp(parsed.params.path)]
    }

    this.ctx.logger.info(`Collecting files in ${walk_path}...`)
    let progress = 0
    for await (const entry of fs.walk(walk_path, walk_options)) {
      const receiver = this.ctx.plugin_script.recievers.find(receiver => receiver.matches(entry))
      if (receiver) {
        this.#add_filepath(stats, receiver, entry)
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

  #add_filepath(stats: FileSystemDiscoverStats, receiver: plugin.FileSystemReceiver, entry: fs.WalkEntry) {
      const filesystem_path_data = {
        directory: false,
        filepath: entry.path,
        priority_instruction: 'first',
        last_ingest_id: null,
        ingest_retriever: receiver.name,
        ingested_at: null,
        checksum: null,
        filename: entry.name,
      }
      try {
        this.models.FilesystemPath.create(filesystem_path_data)
        stats.created.files ++
        this.#add_directories(stats, path.dirname(entry.path))
      } catch (e) {
        if (e instanceof torm.errors.UniqueConstraintError) {
          stats.existing.files ++
          const filesystem_path = this.models.FilesystemPath.select_one({filepath: e.params.filepath}, {or_raise: true})
          this.models.FilesystemPath.update({
            id: filesystem_path.id,
            ingest_retriever: filesystem_path_data.ingest_retriever,
            updated_at: new Date(),
          })
        }
        else throw e
      }
  }

  #add_directories(stats: FileSystemDiscoverStats, filepath: string) {
    try {
      this.models.FilesystemPath.create({
        directory: true,
        filepath: filepath,
        priority_instruction: 'none',
        last_ingest_id: null,
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
