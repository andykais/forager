import type { Config } from '$lib/server/config.ts'
import { BaseController } from '$lib/base_controller.ts'
import {
  create_focuser,
  SettingsRune,
  MediaListRune,
  MediaSelectionsRune,
  create_dimensional_rune
} from '$lib/runes/index.ts'
import { MediaQueryParamsRune, type PageMode, type QueryParamsConfig } from '$lib/runes/media_queryparams.svelte.ts'

export type { PageMode } from '$lib/runes/media_queryparams.svelte.ts'

export interface MediaPageConfig {
  mode: PageMode
  series_id?: number
}

/**
 * Unified controller for media page views (browse, series, etc.).
 * Configured via mode to handle different page types.
 */
export class MediaPageController extends BaseController {
  public mode: PageMode
  public series_id?: number

  runes: {
    media_list: MediaListRune
    focus: ReturnType<typeof create_focuser>
    dimensions: ReturnType<typeof create_dimensional_rune>
    settings: SettingsRune
    media_selections: MediaSelectionsRune
    queryparams: MediaQueryParamsRune
  }

  public constructor(config: Config, page_config: MediaPageConfig) {
    super(config)
    this.mode = page_config.mode
    this.series_id = page_config.series_id

    const media_list_rune = new MediaListRune(this.client)
    this.runes = {
      media_list: media_list_rune,
      focus: create_focuser(),
      dimensions: create_dimensional_rune(),
      settings: new SettingsRune(this.client, this.config),
      media_selections: new MediaSelectionsRune(this.client, media_list_rune),
      queryparams: new MediaQueryParamsRune(this.client, media_list_rune, {
        mode: page_config.mode,
        series_id: page_config.series_id,
      }),
    }
  }

  /** Whether this is a browse page */
  get is_browse(): boolean {
    return this.mode === 'browse'
  }

  /** Whether this is a series page */
  get is_series(): boolean {
    return this.mode === 'series'
  }
}
