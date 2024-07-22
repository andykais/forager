import * as fs from '@std/fs'
import { Actions } from '~/actions/lib/base.ts'
import { type inputs, parsers } from '~/inputs/mod.ts'
import { FileProcessor } from '~/lib/file_processor.ts'
import * as errors from '~/lib/errors.ts'


class KeypointActions extends Actions {
  create = async (params: inputs.KeypointCreate) => {
    const parsed = parsers.KeypointCreate.parse(params)
    const media_reference = this.models.MediaReference.select_one({id: params.media_reference_id}, {or_raise: true})
    const media_file = this.models.MediaFile.select_one({media_reference_id: media_reference.id}, {or_raise: true})

    // TODO generate thumbnails
    // unknown: how do these work with normal generated thumbnails? Do we filter these out with a `media_thumbnail::kind` field?
    const file_processor = new FileProcessor(this.ctx, media_file.filepath)
    // TODO minor optimization, we can grab this info from the MediaFile model. Probably with a MediaFile.get_media_info(media_reference_id) helper
    const media_file_info = await file_processor.get_info()
    const thumbnails = await file_processor.create_thumbnails_at_timestamp(media_file_info, media_file.checksum, parsed.start_timestamp)

    const transaction = this.ctx.db.transaction_async(async () => {
      const tag_record = this.tag_create(parsed.tag)
      // creating a keypoint implicitly adds a linked tag
      // TODO handle multiple keypoints with the same tag
      this.models.MediaReferenceTag.create({ media_reference_id: media_reference.id, tag_id: tag_record.id })

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

      await Deno.mkdir(thumbnails.destination_folder, {recursive: true})
      const thumbnail = thumbnails.thumbnails[0]
      this.models.MediaThumbnail.create({
        media_file_id: media_file.id,
        filepath: thumbnail.destination_filepath,
        kind: 'keypoint',
        media_timestamp: thumbnail.timestamp,
      })
      await fs.move(thumbnail.source_filepath, thumbnail.destination_filepath, {overwrite: true})
      await Deno.remove(thumbnails.source_folder)

      return keypoint
    })

    const keypoint = await transaction()

    return keypoint
  }
}


export { KeypointActions }
