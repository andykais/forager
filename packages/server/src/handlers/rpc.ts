import * as rpc_sveltekit from '@andykais/ts-rpc/adapters/sveltekit.ts'
import { Api, type ApiContext } from '../api.ts'


/**
 * Build a request handler for the RPC endpoint. The returned function expects
 * a plain `Request` whose body is the rpc `RequestContract` (same shape as
 * what `@andykais/ts-rpc` already serializes on the client).
 *
 * Implementation note: ts-rpc's public JSR exports only include framework
 * adapters (Oak, SvelteKit) and the base adapter is internal. The SvelteKit
 * adapter only ever reads `event.request` off its argument, so we wrap it
 * with a minimal stub event. This is intentionally tactical — once ts-rpc
 * ships a `Request → Response` adapter, swap this back to that.
 */
export function create_rpc_handler(context: ApiContext): (request: Request) => Promise<Response> {
  const sveltekit_handler = rpc_sveltekit.adapt(Api, context)
  return async (request: Request): Promise<Response> => {
    // deno-lint-ignore no-explicit-any
    return await sveltekit_handler({ request } as any)
  }
}
