import { Actions, type MediaSeriesResponse } from '~/actions/lib/base.ts'
import { inputs, parsers } from '~/inputs/mod.ts'
import * as result_types from '~/models/lib/result_types.ts'


class SeriesActions extends Actions {
  create = (media_info?: inputs.MediaInfo, tags?: inputs.Tag[]): MediaSeriesResponse => {
    const parsed = {
      media_info: parsers.MediaReferenceUpdate.parse(media_info ?? {}),
      tags: tags?.map(t => parsers.Tag.parse(t)) ?? [],
    }

    const transaction = this.ctx.db.transaction_sync(() => {
      const media_reference = this.models.MediaReference.create({
        media_series_reference: true,

        media_sequence_index: 0,
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
        this.models.MediaReferenceTag.create({ media_reference_id: media_reference.id, tag_id })

        const tag_record = this.models.Tag.select_one({id: tag_id}, {or_raise: true})
        tags.push(tag_record)
      }
      return { media_reference, tags }
    })

    const transaction_result = transaction()
    // no thumbnails should exist yet, so we give it limit: 0
    const thumbnails = this.models.MediaThumbnail.select_many({series_id: transaction_result.media_reference.id, limit: 0})
    return {
      media_type: 'media_series',
      media_reference: this.models.MediaReference.select_one({id: transaction_result.media_reference.id}, {or_raise: true}),
      tags: transaction_result.tags,
      thumbnails,
    }
  }

  add = (params: inputs.SeriesItem) => {
    const parsed = parsers.SeriesItem.parse(params)

    const media_series_reference = this.models.MediaReference.select_one_media_series(parsed.series_id)
    // making it default to the back of the list is more complicated (either storing that data on MediaReference or doing MAX() sql call) so for now we just default to putting it on the front of the list
    const series_index = parsed.series_index ?? 0

    const series_item = this.models.MediaSeriesItem.create({
      series_id: parsed.series_id,
      media_reference_id: parsed.media_reference_id,
      series_index: series_index,
    })!
    return this.models.MediaSeriesItem.select_one({id: series_item.id})
  }

  get = (params: inputs.SeriesId): MediaSeriesResponse => {
    const parsed = parsers.SeriesId.parse(params)
    const media_reference = this.models.MediaReference.select_one_media_series(parsed.series_id)
    const tags = this.models.Tag.select_many({media_reference_id: parsed.series_id})
    return {
      media_type: 'media_series',
      media_reference,
      tags,
      thumbnails: this.models.MediaThumbnail.select_many({series_id: parsed.series_id, limit: 0}),
    }
  }
}


export { SeriesActions }
