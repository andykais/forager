import type { Forager, MediaResponse } from '@forager/core'

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

export function create_selector() {
  let selected_thumbnails = $state<ThumbnailSelections>({type: 'none'})
  let current_selection = $state<CurrentSelection>({
    show: false,
    media_response: null,
    result_index: 0,
  })
  return {
    get thumbnail_selections() {
      return selected_thumbnails
    },

    get current_selection() {
      return current_selection
    },

    update(results: MediaResponse[], updated_media_response: MediaResponse) {
      const result_index = current_selection.result_index
      results[result_index] = updated_media_response
      current_selection.media_response = updated_media_response
    },

    is_currently_selected(media_reference_id: number) {
      if (current_selection.media_response?.media_reference.id === media_reference_id) {
        return true
      }
      return false
    },

    set_current_selection(media_response: MediaResponse, result_index: number) {
      if (this.is_currently_selected(media_response.media_reference.id)) {
        this.open_media()
      } else {
        current_selection.media_response = media_response
        current_selection.result_index = result_index
      }
    },

    open_media() {
      if (current_selection.media_response) {
        current_selection.show = true
      }
    },

    close_media() {
      current_selection.show = false
    },

    next_media(results: MediaResponse[]) {
      let next_index = 0
      if (
        selected_thumbnails.type === 'ids' && selected_thumbnails.media_reference_ids.length <= 1
        || selected_thumbnails.type === 'none'
      ) {
        next_index = (current_selection.result_index + 1) % results.length
      } else {
        throw new Error('unimplemented')
      }

      current_selection.media_response = results[next_index]
      current_selection.result_index = next_index
    },

    prev_media(results: MediaResponse[]) {
      let prev_index = 0
      if (
        selected_thumbnails.type === 'ids' && selected_thumbnails.media_reference_ids.length <= 1
        || selected_thumbnails.type === 'none'
      ) {
        prev_index = current_selection.result_index - 1
        if (prev_index < 0) {
          prev_index = results.length - 1
        }
      } else {
        throw new Error('unimplemented')
      }
      current_selection.media_response = results[prev_index]
      current_selection.result_index = prev_index
    }
  }
}

export type MediaSelectionsRune = ReturnType<typeof create_selector>
