// `@forager/server` owns the RPC `Api` definition as of Phase 1 of the
// Tauri port. This file remains as a re-export so existing `$lib/api.ts`
// imports (e.g. `BaseController`'s `rpc.create<ApiSpec>(...)`) keep working.
export { Api, type ApiSpec, type ApiContext } from '@forager/server/api'
