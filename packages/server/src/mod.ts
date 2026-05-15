/**
 * @module
 *
 * Framework-agnostic HTTP server for Forager. Provides:
 *
 * - {@linkcode ForagerServer}: a standalone server that owns the RPC endpoint
 *   and media/thumbnail streaming, suitable for `forager serve`.
 * - {@linkcode try_handle_request}-style handlers for embedding into an
 *   existing HTTP server (e.g. SvelteKit) that wants Forager routes mounted
 *   on the same origin.
 *
 * @example
 * ```ts
 * import { Forager } from '@forager/core'
 * import { ForagerServer, load_config } from '@forager/server'
 *
 * const config = await load_config('./forager.yml')
 * const forager = new Forager(config.core)
 * forager.init()
 *
 * const server = new ForagerServer({ forager, config })
 * await server.start({ port: 8000 })
 * ```
 */

export { ForagerServer } from './server.ts'
export type { ForagerServerOptions, ForagerServerListenOptions } from './server.ts'

export { Api } from './api.ts'
export type { ApiContext, ApiSpec } from './api.ts'

export { PackagesConfig, load_config } from './config.ts'
export type { Config } from './config.ts'

export {
  create_rpc_handler,
  handle_media_file_request,
  handle_thumbnail_request,
} from './handlers/mod.ts'
