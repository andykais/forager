import {Rune} from '$lib/runes/rune.ts'
import type { BaseController } from '$lib/base_controller.ts'
import type { MediaResponse, inputs, type model_types } from '@forager/core'


interface State {
  media: MediaResponse
  full_thumbnails: MediaResponse['thumbnails'] | undefined
}


interface SearchParams {}

export class MediaViewRune extends Rune {
  media_type!: MediaResponse['media_type'] | 'grouped'
  state = $state<State>()
  current_view: model_types.View

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

  public async star(stars: number) {
    const updated = await this.client.forager.media.update(
      this.media_reference.id,
      {stars}
    )
    this.media = updated
  }

  public async load_detailed_view() {
    throw new Error('requires override')
  }

  public async add_view() {
    // TODO track view and update it as a video loops, or as an image has stayed open for a while
    const view_response = await this.client.forager.views.start({media_reference_id: this.media_reference.id })
    this.current_view = view_response.view
    this.state.media.media_reference.view_count = view_response.media_reference.view_count
  }

  static create(client: BaseController['client'], media_response: MediaResponse, search_params: SearchParams) {
    if (media_response.media_type === 'media_file') {
      return new MediaFileRune(client, media_response)
    } else if (media_response.media_type === 'media_series') {
      return new MediaSeriesRune(client, media_response)
    } else if (media_response.media_type === 'grouped') {
      return new MediaGroupRune(client, media_response, search_params)
    } else {
      throw new Error(`Unexpected media_response ${JSON.stringify(media_response)}`)
    }
  }

  public img_fit_classes() {
    throw new Error('requires override')
  }

}


export class MediaFileRune extends MediaViewRune {
  media_type  = 'media_file' as const satisfies MediaResponse['media_type']
  series_index?: number

  constructor(client: BaseController['client'], media_response: MediaResponse) {
    super(client, media_response)
    // @ts-ignore - series_index is only present in SeriesSearchResponse
    this.series_index = media_response.series_index
  }

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

  public img_fit_classes() {
    if (this.media.media_file.width > this.media.media_file.height) {
      // its long edge is wide
      return "w-full"
    } else {
      // its long edge is tall
      return "h-full"
    }
  }
}


export class MediaSeriesRune extends MediaViewRune {
  media_type  = 'media_series' as const satisfies MediaResponse['media_type']
  series_index?: number

  constructor(client: BaseController['client'], media_response: MediaResponse) {
    super(client, media_response)
    // @ts-ignore - series_index is only present in SeriesSearchResponse
    this.series_index = media_response.series_index
  }

  public override async load_detailed_view() {
    if (this.state!.full_thumbnails) return
    const series = await forager.series.get({series_id: media_response.media_reference.id })
    this.state!.full_thumbnails = series.thumbnails
    const series_items = await forager.media.search({query: {series_id: media_response.media_reference.id }})
    // TODO attach series items
  }

  public img_fit_classes() {
    console.warn(`media series img fit functions are not implemented`)
    return "w-full"
  }
}


interface GroupState {
  media_list: MediaResponse[]
}
export class MediaGroupRune extends MediaViewRune {
  media_type  = 'grouped' as const
  grouped_state = $state<GroupState>({
    media_list: []
  })

  protected constructor(client: BaseController['client'], media_response: MediaResponse, search_params: SearchParams) {
    // debugger
    super(client, media_response)

    const {group_by, cursor, ...merged_search_params} = search_params

    if (group_by['tag_group'] !== undefined) {
      merged_search_params.query = {...merged_search_params.query}
      merged_search_params.query.tags = merged_search_params.query.tags
          ? [...merged_search_params.query.tags]
          : []
      const tag = `${group_by.tag_group}:${media_response.group.value}`
      merged_search_params.query.tags.push(tag)
      if (merged_search_params.sort_by === 'count') {
        merged_search_params.sort_by = 'created_at'
      }
      merged_search_params.limit = 1 // TODO until we implement a filmstrip render, we only need one image
    } else {
      throw new Error(`unexpected search group`)
    }

    this.client.forager.media.search(merged_search_params)
      .then((result: {}) => {
        this.grouped_state.media_list = result.results
      })
  }

  get group_metadata() {
    return this.media.group
  }

  get preview_thumbnail() {
    return this.grouped_state.media_list.at(0)?.thumbnails.results[0] ?? {filepath: null}
  }

  public img_fit_classes() {
    if (this.grouped_state.media_list.length === 0) {
      return "w-full h-full"
    } else {
      const media = this.grouped_state.media_list[0]
      if (media.media_file.width > media.media_file.height) {
        // its long edge is wide
        return "w-full"
      } else {
        // its long edge is tall
        return "h-full"
      }
    }
  }
}

export type MediaViewRunes = MediaSeriesRune | MediaFileRune
