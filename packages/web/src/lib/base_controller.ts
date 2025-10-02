import type { Config } from '$lib/server/config.ts'
import {create_focuser, SettingsRune} from '$lib/runes/index.ts'
import {Keybinds} from '$lib/keybinds.ts'


abstract class BaseController {
  keybinds: Keybinds
  #config: Config | undefined

  abstract runes: {
    focus: ReturnType<typeof create_focuser>
    settings: SettingsRune
  }

  constructor(config: Config) {
    this.#config = config
    this.keybinds = new Keybinds(config)
  }

  get config() {
    if (this.#config) return this.#config
    else throw new Error(`Controller::config not initialized`)
  }

  abstract handlers: {}
}

export { BaseController }
