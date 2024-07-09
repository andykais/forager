import { Actions } from '~/actions/lib/base.ts'
import { inputs, parsers } from '~/inputs/mod.ts'
import * as errors from '../lib/errors.ts'

class SeriesActions extends Actions {
  create = (media_info?: inputs.MediaInfo, tags?: inputs.Tag[]) => {
    const parsed = {
      media_info: parsers.MediaReferenceUpdate.parse(media_info ?? {}),
      tags: tags?.map(t => parsers.Tag.parse(t)) ?? [],
    }

    const media_reference = this.models.MediaReference.create({
      media_series_reference: true,

      media_sequence_index: 0,
      stars: 0,
      view_count: 0,
      ...media_info 
    })!

    return this.models.MediaReference.select_one({id: media_reference.id}, {or_raise: true})
  }

  add = (params: inputs.SeriesItem) => {
    const parsed = parsers.SeriesItem.parse(params)

    const media_series_reference = this.models.MediaReference.select_one_media_series_reference(parsed.series_id)
    // making it default to the back of the list is more complicated (either storing that data on MediaReference or doing MAX() sql call) so for now we just default to putting it on the front of the list
    const series_index = parsed.series_index ?? 0

    const series_item = this.models.MediaSeriesItem.create({
      media_series_reference_id: parsed.series_id,
      media_reference_id: parsed.media_reference_id,
      series_index: series_index,
    })!
    return this.models.MediaSeriesItem.select_one({id: series_item.id})
  }

  get = (params: inputs.SeriesId) => {
    const parsed = parsers.SeriesId.parse(params)
    return this.models.MediaReference.select_one_media_series_reference(parsed.series_id)
  }
}


export { SeriesActions }
