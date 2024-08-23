import type { RequestHandler } from "@sveltejs/kit"

export const PUT: RequestHandler = (params) => {
  return new Response('foobar')
}
