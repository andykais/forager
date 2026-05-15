import { type Forager } from '@forager/core'
import { Logger, type LogLevel } from '@forager/core/logger'
import { trace } from '@opentelemetry/api'
import { create_rpc_handler } from './handlers/rpc.ts'
import { handle_media_file_request } from './handlers/media_file.ts'
import { handle_thumbnail_request } from './handlers/thumbnail.ts'
import type { Config } from './config.ts'
import type { ApiContext } from './api.ts'


export interface ForagerServerOptions {
  forager: Forager
  config: Config
  logger?: { level: LogLevel }
}

export interface ForagerServerListenOptions {
  hostname?: string
  port?: number
}


/**
 * Framework-agnostic Forager HTTP server.
 *
 * Owns the RPC endpoint (`/rpc/*`) and the media/thumbnail streaming routes
 * (`/files/media_file/:id`, `/files/thumbnail/:id`). Everything else is
 * outside its scope — embedders (e.g. `@forager/web`'s SvelteKit shell) are
 * expected to call {@linkcode ForagerServer.try_handle_request} first and
 * fall back to their own handling when it returns `null`.
 */
export class ForagerServer {
  readonly #context: ApiContext
  readonly #logger: Logger
  readonly #rpc_handler: (request: Request) => Promise<Response>
  readonly #routes: {
    rpc: URLPattern
    media_file: URLPattern
    thumbnail: URLPattern
  }
  #server?: Deno.HttpServer

  constructor(options: ForagerServerOptions) {
    this.#logger = new Logger('forager.server', options.logger?.level)
    this.#context = { forager: options.forager, config: options.config }
    this.#rpc_handler = create_rpc_handler(this.#context)
    this.#routes = {
      rpc: new URLPattern({ pathname: '/rpc/:signature' }),
      media_file: new URLPattern({ pathname: '/files/media_file/:id' }),
      thumbnail: new URLPattern({ pathname: '/files/thumbnail/:id' }),
    }
  }

  /**
   * Returns a `Response` if the request matches one of this server's owned
   * routes, otherwise `null` so the embedder can route it elsewhere
   * (e.g. SvelteKit's HTML routes).
   */
  try_handle_request = async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)

    const span = trace.getActiveSpan()
    if (span) span.updateName(`${request.method} ${url.pathname}`)

    if (this.#routes.rpc.test(url)) {
      this.#logger.debug(() => `${request.method} ${url.pathname} → rpc`)
      return await this.#rpc_handler(request)
    }

    const media_file_match = this.#routes.media_file.exec(url)
    if (media_file_match) {
      const id = media_file_match.pathname.groups.id ?? ''
      this.#logger.debug(() => `${request.method} ${url.pathname} → media_file(${id})`)
      return await handle_media_file_request(request, this.#context, { id })
    }

    const thumbnail_match = this.#routes.thumbnail.exec(url)
    if (thumbnail_match) {
      const id = thumbnail_match.pathname.groups.id ?? ''
      this.#logger.debug(() => `${request.method} ${url.pathname} → thumbnail(${id})`)
      return await handle_thumbnail_request(request, this.#context, { id })
    }

    return null
  }

  /**
   * Start a standalone HTTP server bound to `hostname:port`. Suitable for the
   * upcoming `forager serve` command; not used by the SvelteKit-embedded path
   * (which calls {@linkcode ForagerServer.try_handle_request} directly).
   */
  async start(options: ForagerServerListenOptions = {}): Promise<void> {
    const hostname = options.hostname ?? '127.0.0.1'
    const port = options.port ?? 8000

    this.#server = Deno.serve({
      hostname,
      port,
      onError: (error) => {
        this.#logger.error(`An error occurred on the server: ${error}`)
        return new Response('Internal Error', { status: 500 })
      },
      onListen: (addr) => {
        this.#logger.info(`Listening on ${addr.hostname}:${addr.port}`)
      },
    }, async (request) => {
      const response = await this.try_handle_request(request)
      if (response) return response
      return new Response('Not Found', { status: 404 })
    })

    await this.#server.finished
  }

  get status(): Promise<void> | undefined {
    return this.#server?.finished
  }

  async shutdown(): Promise<void> {
    if (this.#server === undefined) {
      throw new Error('Server has not been started yet')
    }
    await this.#server.shutdown()
  }
}
