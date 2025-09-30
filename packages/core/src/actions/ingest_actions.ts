import * as path from '@std/path'
import * as errors from '~/lib/errors.ts'
import { Actions } from '~/actions/lib/base.ts'
import { inputs, parsers } from '~/inputs/mod.ts'
import * as plugin from '~/lib/plugin_script.ts'


/**
  * Actions for ingesting new files into Forager
  */
class IngestActions extends Actions {

  // NOTE this part of the design is somewhat "brittle" because we are protecting against multiple runners within a single process
  // if for some reason, someone ran multiple forager instances pointed at the same database, we would not be able to enforce this constraint
  #singleton_data: {
    status: 'running' | 'stopped'
  } = {
    status: 'stopped',
  }

  /**
    * Ingest files stored in forager from {@link FileSystem.discover}
    */
  start = async (params?: inputs.IngestStart) => {
    const start_time = performance.now()
    const parsed = {
      params: parsers.IngestStart.parse(params)
    }

    if (this.#singleton_data.status === 'running') {
      throw new Error(`Ingest is already active. Forager does not support running multiple ingestions at the same time.`)
    }
    this.#singleton_data.status = 'running'

    // this.ctx.logger.info(`Starting ingest with ${queued_entries.length} files`)

    const stats: plugin.FileSystemReceiverContext['stats'] = {
      created: 0,
      updated: 0,
      existing: 0,
      duplicate: 0,
      errored: 0,
    }

    const total = this.models.FilesystemPath.count_entries({
      ingest_retriever: parsed.params.query?.retriever,
      ingested: false,
      filepath: parsed.params.query?.path
    })

    let total_progress = 0
    while (true) {
      const file = this.models.FilesystemPath.select_one({
        ingested: false,
        ingest_retriever: parsed.params.query?.retriever,
        filepath: parsed.params.query?.path,
      })

      if (file === undefined) {
        // no more files to ingest, end loop
        break
      }

      const receiver = this.ctx.plugin_script.recievers.find(receiver => receiver.name === file?.ingest_retriever)

      try {
        if (receiver === undefined) {
          throw new Error(`unhandled code branch, no plugin is registered with receiver name '${file?.ingest_retriever}'`)
        }

        await receiver.foreach({
          default_metadata: params?.set, // NOTE we use the unparsed input here because our layer below here also parses media_info/tags
          file_id: file.id,
          receiver,
          stats,
          entry: {
            isDirectory: false,
            isFile: true,
            isSymlink: false,
            name: file.filename!,
            path: file.filepath,
          },
          forager: this.ctx.forager,
          logger: this.ctx.logger,
          add: this.#add.bind(this)
        })
      } catch (e) {
        this.ctx.logger.error(`An error occurred at entry '${file.filepath}':`)
        this.ctx.logger.error(e)
        throw e
      }

      total_progress ++
      this.ctx.logger.info(() => {
        const percent_complete = this.format_decimals((total_progress / total) * 100) + '%'
        return `Stats: progress: ${total_progress}/${total} (${percent_complete}), created: ${stats.created}, updated: ${stats.updated}, duplicates: ${stats.duplicate}, nooped: ${stats.existing}, errored: ${stats.errored}\n`
      })
    }

    const duration = performance.now() - start_time
    this.ctx.logger.info(`Created ${stats.created} media files, updated ${stats.updated} and ignored ${stats.existing} existing and ${stats.duplicate} duplicate files in ${this.format_duration(duration)}.`)
    this.#singleton_data.status = 'stopped'
    return { stats }
  }

  async #add(ctx: plugin.FileSystemReceiverContext, filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.TagList) {
    if (ctx.default_metadata?.media_info) {
      media_info = {...ctx.default_metadata.media_info as inputs.MediaInfo, ...media_info}
    }
    if (ctx.default_metadata?.tags) {
      tags = ctx.default_metadata.tags.concat(tags ?? [] as inputs.TagList)
    }

    // NOTE we frontload the update ahead of the create call for a faster path (the create call will do filesystem checksum checks before doing sqlite checks)
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

      this.models.FilesystemPath.update({
        id: ctx.file_id,
        ingested: true,
        ingested_at: new Date(),
        checksum: undefined,
        updated_at: new Date(),
        ingest_retriever: undefined,
      })
      return
    } catch(e) {
      if (e instanceof errors.NotFoundError) {} // this is the normal flow for adding new media
      else throw e
    }

    try {
      const {media_file} = await ctx.forager.media.create(filepath, media_info, tags, {editor: ctx.receiver.name})
      this.models.FilesystemPath.update({
        id: ctx.file_id,
        ingested: true,
        ingested_at: new Date(),
        checksum: media_file.checksum,
        updated_at: new Date(),
        ingest_retriever: undefined,
      })
      ctx.stats.created += 1
    } catch (e) {
      let file_identifier = filepath
      if (filepath !== ctx.entry.path) {
        file_identifier = `${filepath} from ${ctx.entry.path}`
      }

      if (e instanceof errors.DuplicateMediaError) {
        ctx.logger.warn(`${file_identifier} has a duplicate checksum (${e.checksum}) to ${e.existing_media_filepath}, skipping`)
        this.models.FilesystemPath.update({
          id: ctx.file_id,
          ingested: true,
          ingested_at: new Date(),
          checksum: e.checksum,
          updated_at: new Date(),
          ingest_retriever: undefined,
        })
        ctx.stats.duplicate += 1
      } else if (e instanceof errors.MediaAlreadyExistsError) {
        if (media_info || tags) {
          // this.ctx.logger.info(`${e.filepath} already exists in database, updating`)
          const {media_reference} = ctx.forager.media.get({filepath: e.filepath})
          // const media_file = this.models.MediaFile.select_one({filepath: e.filepath}, {or_raise: true})
          const {media_file} = ctx.forager.media.update(media_reference.id, media_info, tags, {editor: ctx.receiver.name})
          this.models.FilesystemPath.update({
            id: ctx.file_id,
          ingested: true,
            ingested_at: new Date(),
            checksum: media_file.checksum,
            updated_at: new Date(),
            ingest_retriever: undefined,
          })
          ctx.stats.updated += 1
        } else {
          ctx.logger.info(`${e.filepath} already exists in database, skipping`)
        }
        ctx.stats.existing += 1
      } else if (e instanceof errors.InvalidFileError) {
        ctx.logger.warn(`${filepath} was an invalid file, skipping`)

        this.models.FilesystemPath.update({
          id: ctx.file_id,
          ingested: true,
          ingested_at: new Date(),
          checksum: undefined,
          updated_at: new Date(),
          ingest_retriever: undefined,
        })
        ctx.stats.errored ++
      } else {
        ctx.logger.error(`${file_identifier} import failed.`)
        ctx.logger.error(e)
        this.models.FilesystemPath.update({
          id: ctx.file_id,
          ingested: true,
          ingested_at: new Date(),
          checksum: undefined,
          updated_at: new Date(),
          ingest_retriever: undefined,
        })
        ctx.stats.errored ++
        // throw e
      }
    }
  }

  /**
    * check the status of ingestion
    */
  status = async (_params: inputs.IngestStatus) => {
    throw new Error('unimplemented')
  }

  /**
    * Stop the ingester from running. If it is not running, this call will error
    */
  stop = async (_params: inputs.IngestStop) => {
    throw new Error('unimplemented')
  }

  /**
    * Retrieve the file system paths previously discovered
    */
  search = (_params: inputs.IngestSearch) => {
    throw new Error('unimplemented')
  }

  /**
    * bulk update the ingest priority on files matching a particular search
    */
  update = (_params: inputs.IngestUpdate) => {
    throw new Error('unimplemented')
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


export { IngestActions }
