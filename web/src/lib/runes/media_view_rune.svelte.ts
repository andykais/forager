import {Rune} from '$lib/runes/rune.ts'
import type { BaseController } from '$lib/base_controller.ts'
import type { MediaResponse, inputs } from '@forager/core'

interface State {
  media: MediaResponse
  full_thumbnails: MediaResponse['thumbnails'] | undefined
}
export class MediaViewRune extends Rune {
  media_type!: MediaResponse['media_type']
  state = $state<State>()

  protected constructor(client: BaseController['client'], media_response: MediaResponse) {
    super(client)
    this.state = {
      media: media_response,
      full_thumbnails: undefined
    }
  }

  get media() {
    return this.state!.media
  }
  set media(media: MediaResponse) {
    return this.state!.media = media
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

  get preview_thumbnail() {
    return this.media.thumbnails.results[0]
  }

  get thumbnails() {
    return this.media.thumbnails
  }

  public update(media_info: inputs.MediaInfo, tags: inputs.MediaReferenceUpdateTags) {
    throw new Error('requires override')
  }

  public async load_detailed_view() {
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
  media_type  = 'media_file' as const satisfies MediaResponse['media_type']

  public override async update(media_info: inputs.MediaInfo, tags: inputs.MediaReferenceUpdateTags) {
    const updated = await this.client.forager.media.update(
      this.media_reference.id,
      media_info,
      tags
    )
    this.media = updated
  }

  public override async load_detailed_view() {
    if (this.state!.full_thumbnails) return
    const result = await this.client.forager.media.get({media_reference_id: this.media_reference.id })
    this.state!.full_thumbnails = result.thumbnails
  }
}


export class MediaSeriesRune extends MediaViewRune {
  media_type  = 'media_series' as const satisfies MediaResponse['media_type']

  public override async load_detailed_view() {
    if (this.state!.full_thumbnails) return
    const series = await forager.series.get({series_id: media_response.media_reference.id })
    this.state!.full_thumbnails = series.thumbnails
    const series_items = await forager.media.search({query: {series_id: media_response.media_reference.id }})
    // TODO attach series items
  }
}

export type MediaViewRunes = MediaSeriesRune | MediaFileRune
