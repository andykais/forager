import type { Config } from '$lib/server/config.ts'
import {BaseController} from '$lib/base_controller.ts'
import {create_focuser, SettingsRune } from '$lib/runes/index.ts'
import { create_dimensional_rune } from './runes/dimensions.svelte.ts'
import { MediaSelectionsRune } from '../../browse/runes/media_selections.svelte.ts'
import { SeriesQueryParamsRune } from './runes/queryparams.svelte.ts'
import { SeriesListRune } from './runes/series_list.svelte.ts'


class SeriesController extends BaseController {
  runes: {
    series_list: SeriesListRune
    focus: ReturnType<typeof create_focuser>
    dimensions: ReturnType<typeof create_dimensional_rune>
    settings: SettingsRune
    media_selections: MediaSelectionsRune
    queryparams: SeriesQueryParamsRune
  }

  public constructor(config: Config, series_id: number) {
    super(config)

    const series_list_rune = new SeriesListRune(this.client, this.settings)
    this.runes = {
      series_list: series_list_rune,
      focus: create_focuser(),
      dimensions: create_dimensional_rune(),
      settings: new SettingsRune(this.client, this.config),
      media_selections: new MediaSelectionsRune(this.client, series_list_rune),
      queryparams: new SeriesQueryParamsRune(this.client, series_list_rune, series_id),
    }
  }
}

export { SeriesController }
