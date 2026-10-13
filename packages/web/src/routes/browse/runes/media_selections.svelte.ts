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
  /** timestamp (in seconds) that a video should start at when it is opened */
  seek_to: number | undefined
}

const CURRENT_SELECTION_DEFAULTS: CurrentSelection = {
  show: false,
  thumbnails: null,
  media_response: null,
  result_index: 0,
  seek_to: undefined,
}
export class MediaSelectionsRune extends Rune {
  #selected_thumbnails = $state<ThumbnailSelections>({type: 'none'})
  #current_selection = $state<CurrentSelection>({...CURRENT_SELECTION_DEFAULTS})

  public constructor(client: BaseController['client'], media_list_rune: MediaListRune) {
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

  public async set_current_selection(media_response: runes.MediaViewRune, result_index: number) {
    this.#current_selection.show
    if (this.is_currently_selected(media_response.media_reference.id)) {
      await this.open_media()
    } else {
      this.#current_selection.media_response = media_response
      this.#current_selection.result_index = result_index
    }
  }

  /** select a search result without opening it */
  public select_media(media_response: runes.MediaViewRune, result_index: number) {
    this.#current_selection.result_index = result_index
    // grouped results are not media references, so there are no media details to show for them
    this.#current_selection.media_response = media_response.media_type === 'grouped' ? null : media_response
  }

  /**
   * open a specific media reference in the media view.
   * The media reference does not need to be a top level search result (e.g. a series item or group entry),
   * result_index refers to the search result it belongs to.
   */
  public async open_entry(media_response: runes.MediaViewRune, result_index: number, options?: {seek_to?: number}) {
    this.#current_selection.media_response = media_response
    this.#current_selection.result_index = result_index
    this.#current_selection.seek_to = options?.seek_to
    await this.open_media()
  }

  public async view_media() {
    await this.#current_selection.media_response?.load_detailed_view()
    if (this.#current_selection.show) {
      await this.#current_selection.media_response?.add_view()
    }
  }

  public clear_current_selection() {
    this.#current_selection = {...CURRENT_SELECTION_DEFAULTS}
  }

  public async open_media() {
    if (this.#current_selection.media_response) {
      this.#current_selection.show = true
    }
    await this.view_media()
  }

  public close_media = () => {
    this.#current_selection.show = false
    this.#current_selection.seek_to = undefined
  }

  /** consume the pending seek timestamp so it is only applied once */
  public take_seek_to(): number | undefined {
    const seek_to = this.#current_selection.seek_to
    this.#current_selection.seek_to = undefined
    return seek_to
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

    await this.view_media()
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

    await this.view_media()
  }
}
