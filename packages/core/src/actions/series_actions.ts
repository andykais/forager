import { Actions, type MediaSeriesResponse, type UpdateEditor } from '~/actions/lib/base.ts'
import { inputs, outputs, parsers } from '~/inputs/mod.ts'
import * as errors from '~/lib/errors.ts'


/**
  * Actions associated with media series.
  */
class SeriesActions extends Actions {
  public create = (media_info?: inputs.MediaSeriesInfo, tags?: inputs.Tag[]): MediaSeriesResponse => {
    const parsed = {
      media_info: parsers.MediaSeriesInfo.parse(media_info ?? {}),
      tags: parsers.TagList.parse(tags ?? [])
    }

    if (parsed.media_info.media_series_name) {
      try {
        this.models.MediaReference.select_one_media_series({media_series_name: parsed.media_info.media_series_name})
        throw new errors.SeriesAlreadyExistsError(parsed.media_info.media_series_name!)
      } catch (e) {
        if (e instanceof errors.NotFoundError) {
          /** noop */
        } else {
          throw e
        }
      }
    }


    const transaction = this.ctx.db.transaction_sync(() => {
      const media_reference = this.models.MediaReference.create({
        media_series_reference: true,
        stars: 0,
        view_count: 0,
        ...media_info 
      })!

      const tags: ReturnType<typeof this.models.Tag.select_one>[] = []

      for (const tag of parsed.tags) {
        const group = tag.group ?? ''
        // const color = get_hash_color(group, 'hsl')
        const color = ''
        const tag_group = this.models.TagGroup.get_or_create({ name: group, color })!
        const {id: tag_id} = this.models.Tag.get_or_create({ alias_tag_id: null, name: tag.name, tag_group_id: tag_group.id, description: tag.description, metadata: tag.metadata })
        this.models.MediaReferenceTag.create({ media_reference_id: media_reference.id, tag_id, tag_group_id: tag_group.id })

        const tag_record = this.models.Tag.select_one({id: tag_id}, {or_raise: true})
        tags.push(tag_record)
      }
      return { media_reference, tags }
    })

    const transaction_result = transaction()
    // no thumbnails should exist yet, so we give it limit: 0
    return this.#get_media_series_response({series_id: transaction_result.media_reference.id })
  }

  public update = (series_id: number, media_info?: inputs.MediaInfo, tags?: inputs.Tag[], editing?: UpdateEditor): MediaSeriesResponse => {
    const parsed = {
      series_id: parsers.MediaReferenceId.parse(series_id),
      media_info: parsers.MediaReferenceUpdate.parse(media_info ?? {}),
      tags: parsers.TagList.parse(tags ?? [])
    }

    if (editing) {
      throw new Error(`unimplemented`)
    }

    // ensure this is a series reference first
    this.models.MediaReference.select_one_media_series({id: series_id})

    const transaction = this.ctx.db.transaction_sync(() => {
      this.models.MediaReference.update({
        id: parsed.series_id,
        ...parsed.media_info,
      })
      for (const tag of parsed.tags) {
        const group = tag.group ?? ''
        // const color = get_hash_color(group, 'hsl')
        const color = ''
        const tag_group = this.models.TagGroup.get_or_create({ name: group, color })!
        const tag_record = this.models.Tag.get_or_create({ alias_tag_id: null, name: tag.name, tag_group_id: tag_group.id, description: tag.description, metadata: tag.metadata })
        this.models.MediaReferenceTag.get_or_create({ media_reference_id: parsed.series_id, tag_id: tag_record.id, tag_group_id: tag_record.tag_group_id })
      }
    })

    transaction()
    return this.#get_media_series_response({series_id: parsed.series_id})
  }

  public add = (params: inputs.SeriesItem) => {
    const parsed = parsers.SeriesItem.parse(params)

    // ensure this is a series reference first
    this.models.MediaReference.select_one_media_series({id: parsed.series_id})

    // making it default to the back of the list is more complicated (either storing that data on MediaReference or doing MAX() sql call) so for now we just default to putting it on the front of the list
    const series_index = parsed.series_index ?? 0

    const series_item = this.models.MediaSeriesItem.create({
      series_id: parsed.series_id,
      media_reference_id: parsed.media_reference_id,
      series_index: series_index,
    })!
    return this.models.MediaSeriesItem.select_one({id: series_item.id})
  }

  public get = (params: inputs.SeriesGet): MediaSeriesResponse => {
    const parsed = parsers.SeriesGet.parse(params)
    return this.#get_media_series_response(parsed)
  }

  #get_media_series_response(params: outputs.SeriesGet): MediaSeriesResponse {
    const media_reference = this.models.MediaReference.select_one_media_series({id: params.series_id, media_series_name: params.series_name})
    const tags = this.models.Tag.select_all({media_reference_id: media_reference.id})
    return {
      media_type: 'media_series',
      media_reference,
      tags,
      thumbnails: this.models.MediaThumbnail.select_many({series_id: media_reference.id, limit: 0}),
    }
  }
}


export { SeriesActions }
