import {Rune} from '$lib/runes/rune.ts'
import type { BaseController } from '$lib/base_controller.ts'
import type { MediaResponse, inputs } from '@forager/core'

export class MediaViewRune extends Rune {
  media = $state<MediaResponse>()

  constructor(client: BaseController['client'], media_response: MediaResponse) {
    super(client)
    this.media = media_response
  }

  get media_type() {
    return this.media.media_type
  }
  get tags() {
    return this.media.tags
  }

  get media_reference() {
    return this.media.media_reference
  }

  get media_file() {
    return this.media.media_file
  }

  get thumbnails() {
    return this.media.thumbnails
  }

  public update(media_info: inputs.MediaInfo, tags: inputs.MediaReferenceUpdateTags) {
    throw new Error('requires override')
  }

  static create(client: BaseController['client'], media_response: MediaResponse) {
    if (media_response.media_type === 'media_file') {
      return new MediaFileRune(client, media_response)
    } else if (media_response.media_type === 'media_series') {
      return new MediaSeriesRune(client, media_response)
    } else {
      throw new Error(`Unexpected media_response ${JSON.stringify(media_response)}`)
    }
  }
}

export class MediaFileRune extends MediaViewRune {

  public override async update(media_info: inputs.MediaInfo, tags: inputs.MediaReferenceUpdateTags) {
    const updated = await this.client.forager.media.update(
      this.media_reference.id,
      media_info,
      tags
    )
    this.media = updated
  }
}

export class MediaSeriesRune extends MediaViewRune {
}
