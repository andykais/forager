import type z from 'zod'
import type { Context } from '~/context.ts'
import * as fs from '@std/fs'
import * as fmt_bytes from '@std/fmt/bytes'
import { type inputs, type outputs, parsers } from '~/inputs/mod.ts'
import type * as result_types from '~/models/lib/result_types.ts'
import { FileProcessor } from '~/lib/file_processor.ts'
import * as errors from '~/lib/errors.ts'
import { get_hash_color } from "~/lib/text_processor.ts";
import { TagJoin } from "../../models/tag.ts";

/**
 * A common return type from {@linkcode Forager.prototype.media} and {@linkcode Forager.prototype.series} actions. Contains a media reference for a series of media and its associated metadata.
 */
export interface MediaSeriesResponse {
  media_type: 'media_series'
  media_reference: result_types.MediaReference
  tags: result_types.Tag[]
  thumbnails: result_types.PaginatedResult<result_types.MediaThumbnail>
}

/**
 * A common return type from the {@linkcode Forager.prototype.media} actions. Contains a media file and its associated metadata.
 */
export interface MediaFileResponse {
  media_type: 'media_file'
  media_reference: result_types.MediaReference
  media_file: result_types.MediaFile
  tags: result_types.Tag[]
  thumbnails: result_types.PaginatedResult<result_types.MediaThumbnail>
  edit_log?: result_types.EditLog[]
}

/**
 * Structure returned from {@linkcode MediaActions.prototype.search}. Can be either a media series or an individual media file.
  */
export type MediaResponse = MediaFileResponse | MediaSeriesResponse

interface SeriesSearchMediaFileResponse extends MediaFileResponse {
  series_index: number
}

interface SeriesSearchMediaSeriesResponse extends MediaSeriesResponse {
  series_index: number
}

/**
 * Structure returned from {@linkcode SeriesActions.prototype.search}. Similar to MediaResponse but includes series_index.
  */
export type SeriesSearchResponse = SeriesSearchMediaFileResponse | SeriesSearchMediaSeriesResponse

/**
  * Return structure from {@linkcode MediaActions.prototype.group}. This contains a count of objects returned based on the grouping mechanic called (e.g. grouping by tag_group "animal" will show a value of "animal:cat", and a count of the number of media references that have the tag "media:cat")
  */
export interface MediaGroupResponse {
  media_type: 'grouped'
  group: {
    /** The values under the grouping (e.g. grouping by tag_group "animal" might have a values like "animal:cat" and "animal:dog") */
    value: string
    /** The number of media references associated with the grouped value */
    count: number
    /** The min/max view_count, depending on if order is asc/desc */
    view_count: number
    /** The min/max last_viewed_at, depending on if order is asc/desc */
    last_viewed_at: Date | null
    /** The min/max source_created_at, depending on if order is asc/desc */
    source_created_at: Date | null
    /** The min/max created_at, depending on if order is asc/desc */
    created_at: Date
    /** The min/max updated_at, depending on if order is asc/desc */
    updated_at: Date
    /** a list of media optionally retrieved with grouped_media_limit under this group */
    media?: MediaResponse[]
  }
}


export interface EditInfo {
  editor?: string
}

export interface CreateEditor extends EditInfo {}
export interface UpdateEditor extends EditInfo {
  overwrite?: boolean
}

class Actions {
  protected ctx: Context
  public constructor(ctx: Context) {
    this.ctx = ctx
  }

  protected get models() {
    return this.ctx.db.models
  }

  protected async media_create(filepath: string, media_info?: inputs.MediaInfo, tags?: inputs.MediaReferenceUpdateTags, editing?: CreateEditor): Promise<MediaFileResponse> {
    const start_time = performance.now()
    const parsed = {
      filepath: parsers.Filepath.parse(filepath),
      media_info: parsers.MediaReferenceUpdate.parse(media_info ?? {}),
      tags: parsers.MediaReferenceUpdateTags.parse(tags ?? []),
      editing: parsers.CreateEditing.parse(editing) ?? this.ctx.config.editing,
    }

    const file_processor = new FileProcessor(this.ctx, filepath)
    const media_file_info = await file_processor.get_info()
    const checksum = await file_processor.get_checksum()

    const existing_media_file = this.models.MediaFile.select_one({checksum})
    if (existing_media_file) {
      if (existing_media_file.filepath === parsed.filepath) {
        throw new errors.MediaAlreadyExistsError(filepath, checksum, existing_media_file.media_reference_id)
      } else {
        // an non-transactional step to exit early if we find the hash existing.
        // this just is a way to skip the video preview early
        throw new errors.DuplicateMediaError(filepath, checksum, existing_media_file.filepath, existing_media_file.media_reference_id)
      }
    }
    const [file_size, thumbnails] = await Promise.all([
      file_processor.get_size(),
      file_processor.create_thumbnails(media_file_info, checksum)
    ])

    // copy the thumbnails into the configured folder before the transaction so they are available when the database records are created
    await fs.copy(thumbnails.source_folder, thumbnails.destination_folder)

    const transaction = this.ctx.db.transaction_sync(() => {
      const media_reference = this.models.MediaReference.create({
        media_series_reference: false,
        stars: 0,
        view_count: 0,
        ...parsed.media_info,
        editors: parsed.editing?.editor ? [parsed.editing.editor] : null
      })

      const media_file = this.models.MediaFile.create({
        ...media_file_info,
        thumbnail_directory_path: thumbnails.destination_folder,
        file_size_bytes: file_size,
        checksum,
        media_reference_id: media_reference.id,
      })!

      // NOTE that on create calls, we ignore tags.remove. This is mostly an implementation detail, since tags.remove is not exposed to the forager.media.create action
      const tag_edits = this.#manage_media_tags(media_reference.id, {...parsed.tags, remove: []}, parsed.editing)

      if (parsed.editing?.editor) {
        this.models.EditLog.create({
          editor: parsed.editing.editor,
          operation_type: 'CREATE',
          changes: {
            media_info: parsed.media_info,
            tags: tag_edits,
          },
          media_reference_id: media_reference.id
        })
      }

      for (const thumbnail of thumbnails.thumbnails) {
        this.models.MediaThumbnail.create({
          media_file_id: media_file.id,
          filepath: thumbnail.destination_filepath,
          kind: 'standard',
          media_timestamp: thumbnail.timestamp,
        })
      }

      return { media_reference, tags, media_file }
    })

    const transaction_result = transaction()

    // clean up the temp thumbnail folder after the transaction completes
    await Deno.remove(thumbnails.source_folder, {recursive: true})
    const output_result = this.get_media_file_result({
      media_reference_id: transaction_result.media_reference.id,
      media_file_id: transaction_result.media_file.id,
      thumbnail_limit: 1,
    })
    const creation_duration = performance.now() - start_time
    this.ctx.logger.info(`Created ${parsed.filepath} (type: ${output_result.media_file.media_type} size: ${fmt_bytes.format(output_result.media_file.file_size_bytes)}) in ${this.format_duration(creation_duration)}`)
    return output_result
  }

  protected media_update(media_reference_id: number, media_info?: inputs.MediaInfo, tags?: inputs.MediaReferenceUpdateTags, editing?: UpdateEditor) {
    const parsed = {
      media_reference_id: parsers.MediaReferenceId.parse(media_reference_id),
      media_info: parsers.MediaInfo.parse(media_info ?? {}),
      tags: parsers.MediaReferenceUpdateTags.parse(tags),
      editing: parsers.UpdateEditing.parse(editing) ?? this.ctx.config.editing,
    }

    const transaction = this.ctx.db.transaction_sync(() => {
      const media_info_updates = {...parsed.media_info}

      // when overwrite is false, we will only overwrite fields that are already owned by this editor (or by no editors at all)
      if (parsed.editing?.overwrite === false) {
        const media_info_last_editors = this.models.EditLog.get_media_info_last_editors({media_reference_id})
        const media_info_update_fields = Object.keys(media_info_updates) as (keyof outputs.MediaInfo)[]
        for (const media_info_field of media_info_update_fields) {
          if (media_info_last_editors[media_info_field] && media_info_last_editors[media_info_field] !== parsed.editing.editor) {
            delete media_info_updates[media_info_field]
          }
        }

      }

      this.models.MediaReference.update({
        id: media_reference_id,
        ...media_info_updates,
      })

      const tag_changes = this.#manage_media_tags(media_reference_id, parsed.tags, parsed.editing)

      if (parsed.editing?.editor) {
        this.models.EditLog.create({
          media_reference_id: media_reference_id,
          operation_type: 'UPDATE',
          editor: parsed.editing?.editor,
          changes: {
            media_info: media_info_updates,
            tags: tag_changes,
          }
        })
      }
    })

    transaction()

    // TODO this will currently error when we pass in a series media reference. We need to handle that
    const media_file = this.models.MediaFile.select_one({media_reference_id}, {or_raise: true})
    return this.get_media_file_result({
      media_reference_id,
      media_file_id: media_file.id,
      thumbnail_limit: 1,
    })
  }

  protected media_get(params: {
    media_reference_id?: number,
    filepath?: string
    thumbnail_limit: number
  }): MediaResponse {
    const { media_reference_id, filepath, thumbnail_limit } = params
    if (media_reference_id && filepath) {
      throw new errors.BadInputError(`Cannot supply both media_reference_id and filepath`)
    }

    let media_reference: result_types.MediaReference
    let media_file: result_types.MediaFile | undefined
    if (media_reference_id !== undefined) {
      media_reference = this.models.MediaReference.select_one({id: media_reference_id}, {or_raise: true})
    } else if (filepath !== undefined) {
      media_file = this.models.MediaFile.select_one({filepath}, {or_raise: true})
      media_reference = this.models.MediaReference.select_one({id: media_file.media_reference_id}, {or_raise: true})
    } else {
      throw new errors.BadInputError(`Either media_reference_id or filepath is required`)
    }

    if (media_reference.media_series_reference) {
      throw new Error('unimplemented')
    } else {
      if (media_file === undefined) {
        media_file = this.models.MediaFile.select_one({media_reference_id: media_reference.id}, {or_raise: true})
      }
      return {
        media_type: 'media_file',
        media_reference,
        media_file,
        tags: this.models.Tag.select_all({media_reference_id: media_reference.id}),
        thumbnails: this.models.MediaThumbnail.select_many({media_file_id: media_file.id, limit: thumbnail_limit}),
        edit_log: this.models.EditLog.select_many({ media_reference_id: media_reference.id }),
      }
    }
  }

  protected tag_create(tag: z.output<typeof parsers.Tag>) {
    const group = tag.group ?? ''
    const color = get_hash_color(group, 'hsl')
    const tag_group = this.models.TagGroup.get_or_create({ name: group, color })!
    const tag_record = this.models.Tag.get_or_create({ alias_tag_id: null, name: tag.name, tag_group_id: tag_group.id, description: tag.description, metadata: tag.metadata })
    return tag_record
  }

  protected get_media_file_result(params: {
    media_reference_id: number,
    media_file_id: number,
    thumbnail_limit: number
  }) {
    const { media_reference_id, media_file_id, thumbnail_limit } = params
    return {
      media_type: 'media_file' as const,
      media_reference: this.models.MediaReference.select_one({id: media_reference_id}, {or_raise: true}),
      media_file: this.models.MediaFile.select_one({media_reference_id: media_reference_id}, {or_raise: true}),
      tags: this.models.Tag.select_all({media_reference_id: media_reference_id}),
      thumbnails: this.models.MediaThumbnail.select_many({media_file_id: media_file_id, limit: thumbnail_limit}),
      edit_log: this.models.EditLog.select_many({ media_reference_id: media_reference_id }),

    }
  }

  #manage_media_tags(media_reference_id: number, tags: outputs.MediaReferenceUpdateTags, editing?: CreateEditor | UpdateEditor): result_types.EditLog['changes']['tags'] {
    const tags_added = new Set<string>()
    const tags_removed = new Set<string>()
    const tags_existing = new Map<string, TagJoin>()
    const editor = editing?.editor
    const overwrite_edits_by_others = editing && 'overwrite' in editing && editing.overwrite

    const existing_tags = this.models.Tag.select_all({media_reference_id: media_reference_id})
    for (const tag of existing_tags) {
      tags_existing.set(this.models.Tag.format_slug(tag), tag)
    }

    if (tags.replace) {
      // remove all existing tags matching the editing stragegy first
      for (const [tag_slug, tag] of tags_existing.entries()) {
        if (editor === undefined || tag.editor === null || tag.editor === editor || overwrite_edits_by_others) {
          this.models.MediaReferenceTag.delete({media_reference_id, tag_id: tag.id})
          tags_removed.add(tag_slug)
        }
      }

      for (const tag of tags.replace) {
        const tag_record = this.tag_create(tag)
        this.models.MediaReferenceTag.get_or_create({ media_reference_id: media_reference_id, tag_id: tag_record.id, tag_group_id: tag_record.tag_group_id, editor })

        tags_removed.delete(this.models.Tag.format_slug(tag))
        if (!tags_existing.has(tag.slug)) {
          tags_added.add(this.models.Tag.format_slug(tag))
        }
      }
    }

    for (const tag of tags.add) {
      const tag_record = this.tag_create(tag)
      this.models.MediaReferenceTag.get_or_create({ media_reference_id: media_reference_id, tag_id: tag_record.id, tag_group_id: tag_record.tag_group_id, editor })
      if (!tags_existing.has(tag.slug)) {
        tags_removed.delete(tag.slug)
        tags_added.add(tag.slug)
      }
    }

    for (const tag of tags.remove) {
      const tag_record = this.models.Tag.select_one({name: tag.name, group: tag.group }, {or_raise: true})
      this.models.MediaReferenceTag.delete({ media_reference_id: media_reference_id, tag_id: tag_record.id })
      tags_removed.add(tag.slug)
    }

    if (this.ctx.config.tags.auto_cleanup) {
      this.models.Tag.delete_unreferenced()
    }

    return {
      added: [...tags_added],
      removed: [...tags_removed],
    }
  }

  protected format_duration(milliseconds: number) {
    if (milliseconds < 1000) {
      return `${this.format_decimals(milliseconds)}ms`
    }
    const seconds = milliseconds / 1000
    if (seconds < 60) {
      return `${this.format_decimals(seconds)}s`
    }
    const minutes = seconds / 60
    if (minutes < 60) {
      return `${this.format_decimals(minutes)}s`
    }
    const hours = minutes / 60
    if (hours < 24) {
      return `${this.format_decimals(hours)}s`
    }
    const days = hours / 60
    return `${this.format_decimals(days)}s`
  }

  protected format_decimals(n: number) {
    if (n % 1 === 0) {
      return n.toString()
    } else {
      return n.toFixed(2)
    }
  }
}

export { Actions }
