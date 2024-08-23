import type { RequestHandler } from "@sveltejs/kit"
import * as rpc from '@andykais/ts-rpc/adapters/sveltekit.ts'
import {Api} from '$lib/api.ts'

export const PUT: RequestHandler = async (params) => {
  const context = params.locals
  return await rpc.adapt(Api, context)(params)
}
