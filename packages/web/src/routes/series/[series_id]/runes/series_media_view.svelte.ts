import {Rune} from '$lib/runes/rune.ts'
import type { BaseController } from '$lib/base_controller.ts'
import type { SeriesSearchResponse, inputs, type model_types } from '@forager/core'


interface State {
  media: SeriesSearchResponse
  full_thumbnails: SeriesSearchResponse['thumbnails'] | undefined
}


export class SeriesMediaViewRune extends Rune {
  media_type!: SeriesSearchResponse['media_type']
  state = $state<State>()
  current_view: model_types.View

  protected constructor(client: BaseController['client'], media_response: SeriesSearchResponse) {
    super(client)
    this.state = {
      media: media_response,
      full_thumbnails: undefined
    }
  }

  get media() {
    return this.state!.media
  }

  set media(media: SeriesSearchResponse) {
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

  get series_index(): number {
    return this.media.series_index
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

  public async star(stars: number) {
    const updated = await this.client.forager.media.update(
      this.media_reference.id,
      {stars}
    )
    this.state!.media = {...this.state!.media, media_reference: updated.media_reference, tags: updated.tags}
  }

  public async load_detailed_view() {
    throw new Error('requires override')
  }

  public async add_view() {
    const view_response = await this.client.forager.views.start({media_reference_id: this.media_reference.id })
    this.current_view = view_response.view
    this.state.media.media_reference.view_count = view_response.media_reference.view_count
  }

  static create(client: BaseController['client'], media_response: SeriesSearchResponse): SeriesMediaViewRune {
    if (media_response.media_type === 'media_file') {
      return new SeriesMediaFileRune(client, media_response)
    } else if (media_response.media_type === 'media_series') {
      return new SeriesMediaSeriesRune(client, media_response)
    } else {
      throw new Error(`Unexpected media_response ${JSON.stringify(media_response)}`)
    }
  }

  public img_fit_classes() {
    throw new Error('requires override')
  }
}


export class SeriesMediaFileRune extends SeriesMediaViewRune {
  media_type = 'media_file' as const satisfies SeriesSearchResponse['media_type']

  public override async update(media_info: inputs.MediaInfo, tags: inputs.MediaReferenceUpdateTags) {
    const updated = await this.client.forager.media.update(
      this.media_reference.id,
      media_info,
      tags
    )
    this.state!.media = {...this.state!.media, media_reference: updated.media_reference, tags: updated.tags}
  }

  public override async load_detailed_view() {
    if (this.state!.full_thumbnails) return
    const result = await this.client.forager.media.get({media_reference_id: this.media_reference.id })
    this.state!.full_thumbnails = result.thumbnails
  }

  public img_fit_classes() {
    if (this.media.media_file.width > this.media.media_file.height) {
      return "w-full"
    } else {
      return "h-full"
    }
  }
}


export class SeriesMediaSeriesRune extends SeriesMediaViewRune {
  media_type = 'media_series' as const satisfies SeriesSearchResponse['media_type']

  public override async load_detailed_view() {
    if (this.state!.full_thumbnails) return
    const series = await this.client.forager.series.get({series_id: this.media_reference.id })
    this.state!.full_thumbnails = series.thumbnails
  }

  public img_fit_classes() {
    console.warn(`media series img fit functions are not implemented`)
    return "w-full"
  }
}
