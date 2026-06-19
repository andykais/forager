import type { RequestHandler } from '@sveltejs/kit'
import { create_rpc_handler } from '@forager/server/handlers'
import type { ApiContext } from '@forager/server'


// Cache the rpc handler per context (forager + config) so realtime/SSE state
// can be shared across requests. In practice context is a stable singleton
// for the lifetime of the SvelteKit server.
let cached_handler: ((req: Request) => Promise<Response>) | undefined
let cached_context: ApiContext | undefined


export const PUT: RequestHandler = async ({ request, locals }) => {
  const context: ApiContext = locals as unknown as ApiContext
  if (!cached_handler || cached_context !== context) {
    cached_handler = create_rpc_handler(context)
    cached_context = context
  }
  return await cached_handler(request)
}
