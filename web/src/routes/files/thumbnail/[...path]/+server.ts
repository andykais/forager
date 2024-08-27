import type { RequestHandler } from "@sveltejs/kit"

export const GET: RequestHandler = async ({params}) => {
  const filepath = `/${params.path}`
  console.log('loading', filepath)
  const file = await Deno.open(filepath)
  return new Response(file.readable)
}
