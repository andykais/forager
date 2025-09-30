import { Actions } from '~/actions/lib/base.ts'
import { type inputs, parsers } from '~/inputs/mod.ts'
import type * as result_types from '~/models/lib/result_types.ts'
import * as errors from '~/lib/errors.ts'


interface ViewResponse {
  view: result_types.View
  media_reference: { view_count: number }
}

/**
  * Actions associated with media views. Record when a media reference is viewed, and for animated media, record how much of it has been viewed..
  */
class ViewActions extends Actions {
  start = (params: inputs.ViewCreate): ViewResponse => {
    const parsed = parsers.ViewCreate.parse(params)
    const media_reference = this.models.MediaReference.select_one({id: params.media_reference_id}, {or_raise: true})

    const view = this.models.View.create({
      media_reference_id: media_reference.id,
      start_timestamp: parsed.start_timestamp ?? 0,
      end_timestamp: undefined,
      duration: 0,
      num_loops: 0,
    })

    const view_count = (media_reference.view_count ?? 0) + 1
    return {
      view,
      media_reference: {
        view_count,
      }
    }
  }

  update = (params: inputs.ViewUpdate): ViewResponse => {
    const parsed = parsers.ViewUpdate.parse(params)
    let view = this.models.View.select_one({id: params.view_id}, {or_raise: true})

    const media_reference = this.models.MediaReference.select_one({id: view.media_reference_id}, {or_raise: true})
    const media_file = this.models.MediaFile.select_one({media_reference_id: view.media_reference_id}, {or_raise: true})
    if (!media_file.animated) {
      if (parsed.start_timestamp !== undefined) throw new errors.BadInputError(`Cannot specify animated view field start_timestamp on non-animated media`)
      if (parsed.end_timestamp !== undefined) throw new errors.BadInputError(`Cannot specify animated view field end_timestamp on non-animated media`)
      if (parsed.num_loops !== undefined) throw new errors.BadInputError(`Cannot specify animated view field view_duration on non-animated media`)
    }

    this.models.View.update({
      id: view.id,
      duration: parsed.view_duration,
      // NOTE this is technically not an atomic update here because I wanted to reuse a not null field as an optional param
      start_timestamp: parsed.start_timestamp ?? view.start_timestamp,
      end_timestamp: parsed.end_timestamp,
      num_loops: parsed.num_loops,
    })

    view = this.models.View.select_one({id: params.view_id}, {or_raise: true})
    return {
      view,
      media_reference: {
        view_count: media_reference.view_count ?? 0,
      }
    }
  }
}


export { ViewActions }
