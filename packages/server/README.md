# @forager/server

Framework-agnostic HTTP server for [Forager](https://github.com/andykais/forager). Owns the RPC endpoint and the `/files/media_file` / `/files/thumbnail` streaming routes, and is intended to be embedded by `@forager/web` (SvelteKit + browser frontend) and the upcoming `@forager/desktop` Tauri shell.

The server is implemented as a request handler over plain `Request` / `Response`, with no dependency on SvelteKit, Oak, or any other framework.

## Usage

```ts
import { Forager } from '@forager/core'
import { ForagerServer } from '@forager/server'
import { load_config } from '@forager/server/config'

const config = await load_config('./forager.yml')
const forager = new Forager(config.core)
forager.init()

const server = new ForagerServer({ forager, config })
await server.start({ hostname: '127.0.0.1', port: 8000 })
```

## Exports

- `@forager/server` — `ForagerServer`, `Api`, `ApiSpec`, request handlers, types.
- `@forager/server/api` — RPC `Api` class (used by SvelteKit and Tauri client type-only imports).
- `@forager/server/config` — `PackagesConfig` Zod schema and `load_config` helper.
- `@forager/server/handlers` — Pure `(request, ctx) => Response` handler functions for `/rpc` and `/files/*`.
