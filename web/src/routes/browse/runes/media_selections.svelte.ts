import type { Forager, MediaResponse } from '@forager/core'
import type * as settings from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'

type MediaResponse = Awaited<ReturnType<Forager['media']['search']>>['results'][0]

interface SelectIndividual {
  type: 'ids'
  media_reference_ids: number[]
}
interface SelectRange {
  type: 'range'
  start_index: number
  stop_index: number
}
interface SelectAll {
  type: 'all'
}
interface SelectNone {
  type: 'none'
}
export type ThumbnailSelections =
  | SelectIndividual
  | SelectRange
  | SelectAll
  | SelectNone

export interface CurrentSelection {
  show: boolean
  media_response: MediaResponse | null
  result_index: number
}

class Rune {
  public constructor(protected client: BaseController['client']) {}
}

export class MediaSelectionsRune extends Rune {
  #selected_thumbnails = $state<ThumbnailSelections>({type: 'none'})
  #current_selection = $state<CurrentSelection>({
    show: false,
    media_response: null,
    result_index: 0,
  })

  public constructor(client: BaseController['client'], protected settings: settings.Rune) {
    super(client)
  }

  public get thumbnail_selections() {
    return this.#selected_thumbnails
  }

  public get current_selection() {
    return this.#current_selection
  }

  public update(results: MediaResponse[], updated_media_response: MediaResponse) {
    const result_index = this.#current_selection.result_index
    results[result_index] = updated_media_response
    this.#current_selection.media_response = updated_media_response
  }

  private async load_thumbnails() {
    if (!this.#current_selection.media_response) {
      throw new Error(`Cannot load thumbnails when no media response is selected`)
    }

    if (this.#current_selection.media_response.media_type === 'media_file' && this.#current_selection.media_response.media_file.animated === false) {
      // we do not have multiple thumbnails for images
      console.log('not animated')
      return
    }

    if (this.#current_selection.media_response.thumbnails.results.length > 1) {
      // lets just assume that these have been loaded
      console.log('already loaded')
      return
    }

    // note that this is currently susceptible to race conditions loading more than once (e.g. flipping back and forth quickly)
    const result = await this.client.forager.media.get({media_reference_id: this.#current_selection.media_response.media_reference.id })
    console.log('updating thumbnails...')
    this.#current_selection.media_response.thumbnails = result.thumbnails
    console.log('updating thumbnails done.')
  }

  private is_currently_selected(media_reference_id: number) {
    if (this.#current_selection.media_response?.media_reference.id === media_reference_id) {
      return true
    }
    return false
  }

  public set_current_selection(media_response: MediaResponse, result_index: number) {
    if (this.is_currently_selected(media_response.media_reference.id)) {
      this.open_media()
    } else {
      this.#current_selection.media_response = media_response
      this.#current_selection.result_index = result_index
    }
  }

  public async open_media() {
    if (this.#current_selection.media_response) {
      this.#current_selection.show = true
    }
    await this.load_thumbnails()
  }

  public close_media = () => {
    this.#current_selection.show = false
  }

  public async next_media(results: MediaResponse[]) {
    let next_index = 0
    if (
      this.#selected_thumbnails.type === 'ids' && this.#selected_thumbnails.media_reference_ids.length <= 1
      || this.#selected_thumbnails.type === 'none'
    ) {
      next_index = (this.#current_selection.result_index + 1) % results.length
    } else {
      throw new Error('unimplemented')
    }

    this.#current_selection.media_response = results[next_index]
    this.#current_selection.result_index = next_index

    await this.load_thumbnails()
  }

  async prev_media(results: MediaResponse[]) {
    let prev_index = 0
    if (
      this.#selected_thumbnails.type === 'ids' && this.#selected_thumbnails.media_reference_ids.length <= 1
      || this.#selected_thumbnails.type === 'none'
    ) {
      prev_index = this.#current_selection.result_index - 1
      if (prev_index < 0) {
        prev_index = results.length - 1
      }
    } else {
      throw new Error('unimplemented')
    }
    this.#current_selection.media_response = results[prev_index]
    this.#current_selection.result_index = prev_index

    await this.load_thumbnails()
  }
}
