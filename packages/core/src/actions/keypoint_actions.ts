import { Actions } from '~/actions/lib/base.ts'
import { inputs, parsers } from '~/inputs/mod.ts'
import { CODECS } from '~/lib/codecs.ts'
import * as errors from '~/lib/errors.ts'
import * as result_types from '~/models/lib/result_types.ts'


class KeypointActions extends Actions {
  create = async (params: inputs.KeypointCreate) => {
    const parsed = parsers.KeypointCreate.parse(params)
    const media_reference = this.models.MediaReference.select_one({id: params.media_reference_id}, {or_raise: true})
    const media_file = this.models.MediaFile.select_one({media_reference_id: media_reference.id}, {or_raise: true})

    // TODO generate thumbnails
    // unknown: how do these work with normal generated thumbnails? Do we filter these out with a `media_thumbnail::kind` field?

    const tag_record = this.tag_create(parsed.tag)
    let duration = 0
    if (params.end_timestamp !== undefined) {
      // NOTE its possible that we are storing a 'lossy' version of the end timestamp by storing it as duration
      // javascript floating point arithmetic means that 5.1 - 4.7 === 0.39999999999999947, not 0.4
      // it just currently makes the most sense to use a duration because a point-in-time keypoint has a duration: 0
      duration = params.end_timestamp - params.start_timestamp
    }
    const keypoint = this.models.MediaKeypoint.create({
      media_reference_id: media_reference.id,
      tag_id: tag_record.id,
      media_timestamp: params.start_timestamp,
      duration,
    })
    console.log(keypoint)
    return keypoint
  }
}


export { KeypointActions }
