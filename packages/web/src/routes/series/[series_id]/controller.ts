import type { Config } from '$lib/server/config.ts'
import { BaseController } from '$lib/base_controller.ts'
import { create_focuser, SettingsRune, MediaListRune, create_dimensional_rune, MediaSelectionsRune } from '$lib/runes/index.ts'
import { SeriesQueryParamsRune } from './runes/queryparams.svelte.ts'

class SeriesController extends BaseController {
  public page_kind = 'series' as const
  public series_id: number

  runes: {
    media_list: MediaListRune
    focus: ReturnType<typeof create_focuser>
    dimensions: ReturnType<typeof create_dimensional_rune>
    settings: SettingsRune
    media_selections: MediaSelectionsRune
    queryparams: SeriesQueryParamsRune
  }

  public constructor(config: Config, series_id: number) {
    super(config)
    this.series_id = series_id

    const settings = new SettingsRune(this.client, this.config)
    const media_list_rune = new MediaListRune(this.client)
    this.runes = {
      media_list: media_list_rune,
      focus: create_focuser(),
      dimensions: create_dimensional_rune(),
      settings,
      media_selections: new MediaSelectionsRune(this.client, media_list_rune),
      queryparams: new SeriesQueryParamsRune(this.client, media_list_rune, series_id),
    }
  }
}

export { SeriesController }

