import type { RequestHandler } from '@sveltejs/kit'
import { handle_media_file_request } from '@forager/server/handlers'
import type { ApiContext } from '@forager/server'


export const GET: RequestHandler = async ({ params, request, locals }) => {
  const context: ApiContext = locals as unknown as ApiContext
  return await handle_media_file_request(request, context, { id: params.id ?? '' })
}
