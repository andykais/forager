import * as path from '@std/path'
import * as errors from '~/lib/errors.ts'
import { Actions } from '~/actions/lib/base.ts'
import { inputs, parsers } from '~/inputs/mod.ts'
import * as plugin from '~/lib/plugin_script.ts'


type IngestEvents = {
  progress: {
    stats: plugin.FileSystemReceiverContext['stats']
  }
  complete: {
    stats: plugin.FileSystemReceiverContext['stats']
  }
  error: {
    name: string
    message: string
    stacktrace: string
  }
}

interface AddMediaFileAck {
  media_reference_id: number | null
  checksum?: string
  status: 'created' | 'updated' | 'existing' | 'duplicate' | 'errored'
}
/**
  * Actions for ingesting new files into Forager
  */
class IngestActions extends Actions<IngestEvents> {

  // NOTE this part of the design is somewhat "brittle" because we are protecting against multiple runners within a single process
  // if for some reason, someone ran multiple forager instances pointed at the same database, we would not be able to enforce this constraint
  #singleton_status: 'running' | 'stopped' = 'stopped'

  /**
    * Ingest files stored in forager from {@link FileSystem.discover}
    */
  start = async (params?: inputs.IngestStart) => {
    const start_time = performance.now()
    const parsed = {
      params: parsers.IngestStart.parse(params)
    }

    if (this.#singleton_status === 'running') {
      throw new Error(`Ingest is already active. Forager does not support running multiple ingestions at the same time.`)
    }
    this.#singleton_status = 'running'

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
      // also mark the entry file ingested, in case the skipped it, we need to mark that it is completed
      this.models.FilesystemPath.update({
        id: file.id,
        ingested: true,
        ingested_at: new Date(),
        // NOTE we are _not_ updating checksum in case that was overridden in the foreach
        // checksum: undefined,
        updated_at: new Date(),
      })

      total_progress ++
      this.ctx.logger.info(() => {
        const percent_complete = this.format_decimals((total_progress / total) * 100) + '%'
        return `Stats: progress: ${total_progress}/${total} (${percent_complete}), created: ${stats.created}, updated: ${stats.updated}, duplicates: ${stats.duplicate}, nooped: ${stats.existing}, errored: ${stats.errored}`
      })
    }

    const duration = performance.now() - start_time
    this.ctx.logger.info(`Created ${stats.created} media files, updated ${stats.updated} and ignored ${stats.existing} existing and ${stats.duplicate} duplicate files in ${this.format_duration(duration)}.`)
    this.#singleton_status = 'stopped'
    this.emit('complete', {
      stats
    })
    return { stats }
  }

  async #add_media_file(ctx: plugin.FileSystemReceiverContext, filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.TagList): Promise<AddMediaFileAck> {
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
        return {media_reference_id: existing_media.media_reference.id, status: 'updated'}
      } else {
        ctx.stats.existing ++
        return {media_reference_id: existing_media.media_reference.id, status: 'existing'}
      }
    } catch(e) {
      if (e instanceof errors.NotFoundError) {} // this is the normal flow for adding new media
      else throw e
    }

    try {
      const created_media = await ctx.forager.media.create(filepath, media_info, tags, {editor: ctx.receiver.name})
      return {media_reference_id: created_media.media_reference.id, checksum: created_media.media_file.checksum, status: 'created'}
    } catch (e) {
      let file_identifier = filepath
      if (filepath !== ctx.entry.path) {
        file_identifier = `${filepath} from ${ctx.entry.path}`
      }

      if (e instanceof errors.DuplicateMediaError) {
        ctx.logger.warn(`${file_identifier} has a duplicate checksum (${e.checksum}) to ${e.existing_media_filepath}, skipping`)
        return {media_reference_id: e.media_reference_id, checksum: e.checksum, status: 'duplicate'}
      } else if (e instanceof errors.AlreadyExistsError) {
        if (!media_info || !tags) {
          ctx.logger.info(`${e.identifier} already exists in database, skipping`)
          return {media_reference_id: e.media_reference_id, status: 'existing'}
        }

        if (e instanceof errors.MediaAlreadyExistsError) {
          const {media_reference} = ctx.forager.media.get({filepath: e.filepath})
          // const media_file = this.models.MediaFile.select_one({filepath: e.filepath}, {or_raise: true})
          const updated_media = ctx.forager.media.update(media_reference.id, media_info, tags, {editor: ctx.receiver.name})
          return {media_reference_id: updated_media.media_reference.id, status: 'updated', checksum: updated_media.media_file.checksum}
        } else if (e instanceof errors.SeriesAlreadyExistsError) {
          const {media_reference} = ctx.forager.series.get({series_name: e.media_series_name})
          const updated_media = ctx.forager.series.update(media_reference.id, media_info, tags, {editor: ctx.receiver.name})
          return {media_reference_id: updated_media.media_reference.id, status: 'updated' }
        } else {
          throw new Error(`unexpected code path for error ${e.constructor.name}: ${e}`)
        }
      } else if (e instanceof errors.InvalidFileError) {
        ctx.logger.warn(`${filepath} was an invalid file, skipping`)
        return {media_reference_id: null, status: 'errored'}
      } else {
        ctx.logger.error(`${file_identifier} import failed.`)
        ctx.logger.error(e)
        return {media_reference_id: null, status: 'errored'}
      }
    }

  }

  async #add_media_series_item(
    _ctx: plugin.FileSystemReceiverContext,
    _filepath: string,
    media_reference_id: number,
    series: inputs.MediaSeriesBulk[0],
    media_info?: inputs.MediaInfo,
    tags?: inputs.TagList
  ): Promise<AddMediaFileAck> {
      if (media_info || tags) {
        throw new Error('unimplemented')
      }
      try {
        const media_series = this.ctx.forager.series.create(series?.series)
        this.ctx.forager.series.add({
          series_id: media_series.media_reference.id,
          media_reference_id: media_reference_id,
          series_index: series.series_index
        })
        return { media_reference_id: media_series.media_reference.id, status: 'created' }
      } catch (e) {
        if (e instanceof errors.SeriesAlreadyExistsError) {
          this.ctx.forager.series.add({
            series_id: e.media_reference_id,
            media_reference_id: media_reference_id,
            series_index: series.series_index
          })
          return { media_reference_id: e.media_reference_id, status: 'updated' }
        } else {
          throw e
        }
      }
  }

  async #add(ctx: plugin.FileSystemReceiverContext, filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.TagList, series?: inputs.MediaSeriesBulk) {
    const media_file_ack = await this.#add_media_file(ctx, filepath, media_info, tags)

    this.models.FilesystemPath.update({
      id: ctx.file_id,
      ingested: true,
      ingested_at: new Date(),
      checksum: media_file_ack.checksum,
      updated_at: new Date(),
      ingest_retriever: undefined,
    })
    ctx.stats[media_file_ack.status] += 1

    if (series && media_file_ack.media_reference_id) {
      for (const series_input of series) {
        const media_series_ack = await this.#add_media_series_item(ctx, filepath, media_file_ack.media_reference_id, series_input)
        ctx.stats[media_series_ack.status] += 1
      }
    }

    this.emit('progress', { stats: ctx.stats })
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
