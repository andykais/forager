import {serveDir, serveFile, type ServeDirOptions} from '@std/http/file-server'
import * as path from '@std/path'
import {Forager} from '@forager/core'
import {Logger, type LogLevel} from '@forager/core/logger'
import { ForagerServer } from '@forager/server'
import { type Config, load_config } from '@forager/server/config'

import build_manifest from './build/build.json' with { type: 'json' }
import * as static_asset_bytes from './build/bytes_imports.ts'

/**
 * @forager/web is, as of phase 3 of the Tauri port, a thin static-SPA host
 * that mounts {@linkcode ForagerServer} for `/rpc/*` and `/files/*`. The
 * SvelteKit runtime is gone — the SPA produced by the custom static
 * adapter is what's served. Static asset bytes are baked into the JSR
 * package via `with { type: 'bytes' }` imports so the whole thing fits
 * inside a single `deno compile`-built CLI binary.
 */

interface ServerOptions {
  // log level for server messages
  logger?: { level: LogLevel }

  // the port the server is hosted on
  port?: number

  // the folder the static browser assets are downloaded into and served from
  asset_folder: string

  // special flag used for development. Disables fetching of assets from jsr.io
  preview?: boolean

  // The Forager instance and resolved config the embedded ForagerServer uses.
  // Required at runtime; the embedding CLI passes them in.
  forager: Forager
  config: Config
}


class Server {
  #options: ServerOptions
  #server?: Deno.HttpServer
  #appDir: string
  #baseDir: string
  #rootDir: string
  #logger: Logger
  #forager_server: ForagerServer
  #routes: {
    immutable_asset: URLPattern
  }
  #serve_dir_options: ServeDirOptions
  #fallback_html_path: string

  constructor(options: ServerOptions) {
    this.#logger = new Logger('forager.web', options?.logger?.level)
    this.#options = options
    this.#appDir = build_manifest.APP_DIR
    this.#baseDir = path.dirname(new URL(import.meta.url).pathname)
    if (options.preview) {
      this.#rootDir = path.join(this.#baseDir, 'build', 'static')
    } else {
      this.#rootDir = path.join(options.asset_folder, build_manifest.package_version)
    }
    this.#routes = {
      immutable_asset: new URLPattern({ pathname: `/${this.#appDir}/immutable/*` }),
    }
    this.#serve_dir_options = {
      fsRoot: this.#rootDir,
      quiet: this.#options.logger?.level !== 'DEBUG',
    }
    this.#fallback_html_path = path.join(this.#rootDir, build_manifest.SPA_FALLBACK)
    this.#forager_server = new ForagerServer({
      forager: options.forager,
      config: options.config,
      logger: options.logger,
    })
  }

  async init() {
    await this.#ensure_static_assets_exist()
  }

  async start(): Promise<void> {
    this.#logger.debug('Starting deno http server')
    this.#server = Deno.serve({
      hostname: '127.0.0.1', // Only bind to localhost
      port: this.#options.port ?? 8000,
      onError: (error) => {
        this.#logger.error(`An error occurred on the server: ${error}`)
        return new Response('Internal Error', { status: 500 })
      },
      onListen: (addr) => {
        this.#logger.info(`Listening on ${addr.hostname}:${addr.port}`)
        this.#logger.debug(`@forager/web version ${build_manifest.package_version}`)
        this.#logger.debug(`static assets served from ${this.#rootDir}`)
      },
    }, this.#handle_request)

    await this.#server.finished
  }

  get status(): Promise<void> | undefined {
    return this.#server?.finished
  }

  async shutdown() {
    if (this.#server === undefined) {
      throw new Error('Server has not been started yet')
    }
    await this.#server.shutdown()
  }

  async #ensure_static_assets_exist() {
    if (this.#options.preview) return

    const static_assets_folder = path.join(this.#options.asset_folder, build_manifest.package_version)

    try {
      const dir_stats = await Deno.stat(static_assets_folder)
      if (!dir_stats.isDirectory) {
        throw new Error(`Unexpected code path. Static asset dir ${static_assets_folder} is a file, not a directory`)
      }
      return
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        /* handled below */
      } else {
        throw e
      }
    }

    this.#logger.debug(`Clearing away any old files in ${this.#options.asset_folder}.`)
    await Deno.remove(this.#options.asset_folder, { recursive: true }).catch(e => {
      if (e instanceof Deno.errors.NotFound) { /* ignore */ } else { throw e }
    })

    this.#logger.debug(`Writing static assets from raw imports into folder ${static_assets_folder}`)

    for (const [file_id, file_bytes] of Object.entries(static_asset_bytes) as [string, Uint8Array][]) {
      const relative_path = build_manifest.generated_files[file_id as keyof typeof build_manifest.generated_files]
      const asset_output_path = path.join(static_assets_folder, relative_path)
      await Deno.mkdir(path.dirname(asset_output_path), { recursive: true })
      await Deno.writeFile(asset_output_path, file_bytes)
      this.#logger.debug(`Wrote ${asset_output_path}`)
    }

    this.#logger.debug(`Completed writing asset files to ${static_assets_folder}`)
  }

  #handle_request = async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    this.#logger.debug(() => `${request.method} ${url.pathname}`)

    // 1. RPC + media/thumbnail streaming via @forager/server.
    const forager_response = await this.#forager_server.try_handle_request(request)
    if (forager_response) return forager_response

    // 2. Static asset on disk.
    const static_response = await serveDir(request, this.#serve_dir_options)
    if (static_response.ok || static_response.status === 304) {
      if (this.#routes.immutable_asset.test(url)) {
        static_response.headers.set('cache-control', 'public, max-age=31536000, immutable')
      }
      return static_response
    }
    // serveDir leaves the body attached on non-ok responses (e.g. 404). Consume
    // it so we don't leak a streaming body when we fall through to the SPA shell.
    await static_response.body?.cancel().catch(() => {})

    // 3. SPA fallback — every unmatched non-API path serves the client shell.
    // SvelteKit then performs client-side routing.
    if (request.method === 'GET' || request.method === 'HEAD') {
      const fallback = await serveFile(request, this.#fallback_html_path)
      if (fallback.ok || fallback.status === 304) {
        // Disable caching of the shell so client deploys roll out immediately.
        fallback.headers.set('cache-control', 'no-cache')
        return fallback
      }
    }

    return new Response('Not Found', { status: 404 })
  }
}


if (import.meta.main) {
  const FORAGER_CONFIG = Deno.env.get('FORAGER_CONFIG')
  if (FORAGER_CONFIG === undefined) {
    throw new Error(`FORAGER_CONFIG environment variable must be set to run @forager/web module directly`)
  }
  const config = await load_config(FORAGER_CONFIG)
  if (config.web.editing) {
    config.core.editing = config.web.editing
  }
  const forager = new Forager(config.core)
  forager.init()
  const server = new Server({
    logger: config.web.logger,
    asset_folder: path.join(Deno.cwd(), 'static_assets'),
    preview: true,
    forager,
    config,
  })
  await server.init()
  await server.start()
}


export { Server }
export { PackagesConfig } from '@forager/server/config'
