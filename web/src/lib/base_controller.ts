import type {ApiSpec} from '$lib/api.ts'
import * as rpc from '@andykais/ts-rpc/client.ts'
import type { Config } from '$lib/server/config.ts'
import {create_focuser} from '$lib/runes/index.ts'
import {Keybinds} from '$lib/keybinds.ts'


abstract class BaseController {
  client: ReturnType<typeof rpc.create<ApiSpec>>
  keybinds: Keybinds
  #config: Config | undefined

  abstract runes: {
    focus: ReturnType<typeof create_focuser>
  }

  constructor() {
    this.client = rpc.create<ApiSpec>(`${window.location.protocol}${window.location.host}/rpc/:signature`)
    this.keybinds = new Keybinds()
  }

  onMount = async () => {
    this.#config = await this.client.config()
    const keybinds_teardown = this.keybinds.onMount(this.#config)

    return () => {
      keybinds_teardown()
    }
  }

  get config() {
    if (this.#config) return this.#config
    else throw new Error(`Controller::config not initialized. onMount must be triggered before using config`)
  }

  abstract handlers: {}
}

export { BaseController }
