import type { Config } from '$lib/server/config.ts'
import { BaseController } from '$lib/base_controller.ts'
import { create_focuser, SettingsRune } from '$lib/runes/index.ts'
import { TagQueryParams } from './runes/queryparams.svelte.ts'


class TagsController extends BaseController {
  runes: {
    focus: ReturnType<typeof create_focuser>
    settings: SettingsRune
    queryparams: TagQueryParams
  }

  handlers = {}

  public constructor(config: Config) {
    super(config)

    this.runes = {
      focus: create_focuser(),
      settings: new SettingsRune(this.client, this.config),
      queryparams: new TagQueryParams(this.client),
    }
  }
}

export { TagsController }
