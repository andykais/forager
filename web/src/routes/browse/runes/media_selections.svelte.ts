import {Rune} from '$lib/runes/rune.ts'
import type { Forager, MediaResponse } from '@forager/core'
import type * as runes from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'

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
  media_response: runes.MediaViewRunes | null
  result_index: number
}

export class MediaSelectionsRune extends Rune {
  #selected_thumbnails = $state<ThumbnailSelections>({type: 'none'})
  #current_selection = $state<CurrentSelection>({
    show: false,
    media_response: null,
    result_index: 0,
  })

  public constructor(client: BaseController['client']) {
    super(client)
  }

  public get thumbnail_selections() {
    return this.#selected_thumbnails
  }

  public get current_selection() {
    return this.#current_selection
  }

  private is_currently_selected(media_reference_id: number) {
    if (this.#current_selection.media_response?.media_reference.id === media_reference_id) {
      return true
    }
    return false
  }

  public set_current_selection(media_response: runes.MediaViewRune, result_index: number) {
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
    await this.#current_selection.media_response?.load_detailed_view()
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

    await this.#current_selection.media_response?.load_detailed_view()
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

    await this.#current_selection.media_response?.load_detailed_view()
  }
}
