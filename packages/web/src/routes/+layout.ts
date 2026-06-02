import * as rpc from '@andykais/ts-rpc/client.ts'
import type { ApiSpec } from '$lib/api.ts'
import { resolve_connection } from '$lib/connection.ts'


/**
 * Load the server config over RPC. As of phase 3 of the Tauri port the SPA
 * is built with `adapter-static` and has no server-side load functions, so
 * we fetch the config the same way every other API call goes out.
 */
export async function load() {
  const connection = resolve_connection()
  if (!connection.base_url) {
    // SSR / prerender — nothing to fetch.
    return { config: undefined }
  }
  const client = rpc.create<ApiSpec>(`${connection.base_url}/rpc/:signature`)
  const config = await client.config()
  return { config }
}

export const ssr = false
export const prerender = false
