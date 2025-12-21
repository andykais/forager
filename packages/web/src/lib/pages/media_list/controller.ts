import type { SettingsRune, MediaListRune } from '$lib/runes/index.ts'
import type { MediaSelectionsRune } from '$lib/runes/media_selections_rune.svelte.ts'
import type { create_dimensional_rune } from '$lib/runes/dimensions_rune.svelte.ts'

export type MediaListPageKind = 'browse' | 'series'

/**
 * Minimal controller shape required by the shared "media list page" UI
 * (header/search, sidebar/details, list, view overlay, footer).
 *
 * This intentionally stays structural (not class-based) so multiple controllers
 * can implement it without tight coupling.
 */
export interface MediaListPageController {
  page_kind: MediaListPageKind

  // Used by components for keyboard handling
  keybinds: {
    handler: (e: KeyboardEvent) => void
    component_listen: (handlers: Record<string, (e: KeyboardEvent) => void>) => void
  }

  runes: {
    media_list: MediaListRune
    media_selections: MediaSelectionsRune
    settings: SettingsRune
    dimensions: ReturnType<typeof create_dimensional_rune>
    queryparams: {
      DEFAULTS: Record<string, unknown>
      current_url: Record<string, unknown>
      serialize: (params: Record<string, unknown>) => string
      goto: (params: Record<string, unknown>) => Promise<void>
      submit: (params: Record<string, unknown>) => Promise<void>
      merge: (partial_params: Record<string, unknown>) => Record<string, unknown>
      popstate_listener: (fn: (params: Record<string, unknown>) => void) => void
      human_readable_summary?: string
    }
  }
}

