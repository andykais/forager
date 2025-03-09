import type { Forager } from '@forager/core'

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
  media_reference_id: number | null
  media_response: MediaResponse | null
}

export function create_selector() {
  let selected_thumbnails = $state<ThumbnailSelections>({type: 'none'})
  let current_selection = $state<CurrentSelection>({
    show: false,
    media_reference_id: null,
    media_response: null,
  })
  return {
    get thumbnail_selections() {
      return selected_thumbnails
    },
    get current_selection() {
      return current_selection
    },

    set_current_selection(e: MouseEvent, media_response: MediaResponse) {
      console.log('set current selection...')
      current_selection.media_response = media_response
    },

    open_media(e: SubmitEvent) {
      console.log('open media...')
      e.preventDefault()
      if (current_selection.media_response) {
        current_selection.show = true
      }
    },

    close_media() {
      current_selection.show = false
    }
  }
}

export type MediaSelectionsRune = ReturnType<typeof create_selector>
