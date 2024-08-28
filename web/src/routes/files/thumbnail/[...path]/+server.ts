import type { RequestHandler } from "@sveltejs/kit"

// TODO safety-wise, this should only accept requests within the configured thumbnail dir
export const GET: RequestHandler = async ({params}) => {
  const filepath = `/${params.path}`
  const file = await Deno.open(filepath)
  return new Response(file.readable)
}
