import type {ApiSpec} from '$lib/api.ts'
import * as rpc from '@andykais/ts-rpc/client.ts'
import type { Config } from '$lib/server/config.ts'


abstract class BaseController {
  client: ReturnType<typeof rpc.create<ApiSpec>>
  #config: Config | undefined

  constructor() {
    this.client = rpc.create<ApiSpec>(`${window.location.protocol}${window.location.host}/rpc/:signature`)
  }

  onMount = async () => {
    this.#config = await this.client.config()
  }

  get config() {
    if (this.#config) return this.#config
    else throw new Error(`Controller::config not initialized. onMount must be triggered before using config`)
  }

  abstract handlers: {}
}

export { BaseController }
