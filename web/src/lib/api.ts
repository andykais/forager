import * as rpc from '@andykais/ts-rpc/adapters/sveltekit.ts'

export class Api extends rpc.ApiController<Context> {
  server_time(): Date {
    return new Date()
  }
}

export type ApiSpec = rpc.InferSpec<typeof Api>
