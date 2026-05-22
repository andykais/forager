import type {ApiSpec} from '$lib/api.ts'
import * as rpc from '@andykais/ts-rpc/client.ts'
import type { Config } from '$lib/server/config.ts'
import { resolve_connection, type Connection } from '$lib/connection.ts'
import {create_focuser, SettingsRune} from '$lib/runes/index.ts'
import {Keybinds} from '$lib/keybinds.ts'


abstract class BaseController {
  client: ReturnType<typeof rpc.create<ApiSpec>>
  keybinds: Keybinds
  connection: Connection
  #config: Config | undefined

  abstract runes: {
    focus: ReturnType<typeof create_focuser>
    settings: SettingsRune
  }

  constructor(config: Config, connection: Connection = resolve_connection()) {
    this.#config = config
    this.connection = connection
    this.client = rpc.create<ApiSpec>(`${connection.base_url}/rpc/:signature`)
    this.keybinds = new Keybinds(config)
  }

  /** URL for streaming a media file from the configured Forager server. */
  media_url(media_reference_id: number): string {
    return `${this.connection.base_url}/files/media_file/${media_reference_id}`
  }

  /**
   * URL for a thumbnail. `index` is appended as a query-string when non-zero
   * for parity with the existing route shape; the server's behaviour for
   * `index` is unchanged from before phase 2.
   */
  thumbnail_url(thumbnail_id: number | undefined, index: number = 0): string {
    const base = `${this.connection.base_url}/files/thumbnail/${thumbnail_id}`
    return index === 0 ? base : `${base}?index=${index}`
  }

  get config() {
    if (this.#config) return this.#config
    else throw new Error(`Controller::config not initialized`)
  }

  abstract handlers: {}
}

export { BaseController }
