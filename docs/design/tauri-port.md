# Tauri port plan

Status: experimental design proposal — no implementation yet.

This document scopes out a port of `@forager/web` to a native [Tauri v2](https://v2.tauri.app/) desktop application. It tries to capture _what has to change_ in the codebase, not how long it will take.

## 1. Goals & constraints

From the original direction, reiterated for grounding:

1. Keep a client/server design. The desktop shell must be able to talk to a Forager backend running on _another_ machine.
2. Keep Svelte. SvelteKit is not a hard requirement — if a different bundler is a better fit for Tauri, it's on the table.
3. Keep the Deno backend. `@forager/core` and the HTTP layer above it stay in Deno; no rewrite to Rust.
4. `forager.yaml` gains a way to point the desktop client at a remote server.
5. CLI is the entrypoint:
   - `forager gui` launches the Tauri window pointing at a configured remote URL.
   - `forager serve` launches the backend with no GUI.
   - `forager gui --serve-local` launches both, side by side, on the same machine.

Non-goals (for the first pass):

- Mobile (Tauri Android/iOS) — out of scope.
- Bundling the Deno backend _inside_ the Tauri app as a sidecar. We will leave that as an option for later (see §10), but the default is "two independent processes that talk over HTTP."
- Auth/authz beyond what's needed to make a remote URL safe enough for personal use on a trusted network.

## 2. Where the current architecture forces decisions

A quick survey of how `@forager/web` is structured today, focusing on the seams that are relevant to a Tauri port:

- **SvelteKit + custom Deno adapter** (`packages/web/svelte.config.js`, `packages/web/adapter/adapter.js`, `packages/web/adapter/lib/mod.ts`). The adapter pre-renders the client, bytes-imports the static assets, and ships a `Server` class that does three things in one Deno process:
  1. Serves static SvelteKit assets.
  2. Runs the SvelteKit SSR/handler.
  3. Holds a singleton `Forager` instance in-process via `event.locals` (set in `packages/web/src/hooks.server.ts`).
- **RPC** lives at `packages/web/src/routes/rpc/[signature]/+server.ts`, built on `@andykais/ts-rpc`'s SvelteKit adapter. The server side is `Api` in `packages/web/src/lib/api.ts`, which calls directly into the in-process `Forager` instance — there is _no_ network hop between web and core today.
- **Media + thumbnail streaming** also lives in SvelteKit endpoints under `packages/web/src/routes/files/...`. They reach into `locals.forager` and `locals.config` and call `Deno.open` / `Deno.stat` on the host's filesystem. This is the hardest piece to make remote-friendly (see §6).
- **Client RPC base URL** is hardcoded to same-origin in `packages/web/src/lib/base_controller.ts`:
  ```ts
  this.client = rpc.create<ApiSpec>(`${window.location.protocol}${window.location.host}/rpc/:signature`)
  ```
  Likewise `MediaView.svelte` and `media_view_rune.svelte.ts` reference `/files/media_file/...` and `/files/thumbnail/...` as relative URLs.
- **CLI integration** (`packages/cli/src/cli.ts`) imports `@forager/web` directly and constructs a `forager.Forager` instance, which is then injected into the SvelteKit server via env. The same `web.Server` object is used by both `init` and `gui` commands.
- **Config** (`packages/web/src/lib/server/config.ts`) is a single Zod schema covering both `core` and `web`. The CLI re-exports this schema as `Config` in `packages/cli/src/inputs.ts`.

The key implication: **today, "web" and "the in-process backend" are conjoined**. To support a remote Forager, we need to factor the backend out of SvelteKit, and to support Tauri we need a frontend that doesn't assume same-origin everything.

## 3. Proposed architecture

We split today's `@forager/web` into three logical pieces. Two are runtime artifacts, one is a build artifact:

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│         Tauri desktop         │     │     Browser (existing UX)    │
│   (packages/desktop)          │     │                              │
│  ┌────────────────────────┐  │     │  ┌────────────────────────┐  │
│  │ Svelte 5 frontend (SPA)│  │     │  │ Svelte 5 frontend (SPA)│  │
│  │ packages/frontend       │  │     │  │ packages/frontend       │  │
│  └────────────────────────┘  │     │  └────────────────────────┘  │
└───────────────┬──────────────┘     └───────────────┬──────────────┘
                │ HTTP/RPC + media stream            │
                ▼                                    ▼
        ┌──────────────────────────────────────────────────┐
        │            @forager/server (Deno)                │
        │   packages/server  (RPC + /files + /thumbnail)   │
        └───────────────────────┬──────────────────────────┘
                                │
                                ▼
                       ┌────────────────────┐
                       │   @forager/core    │
                       └────────────────────┘
```

New / changed packages:

| Package | Status | Responsibility |
| --- | --- | --- |
| `@forager/core` | unchanged | DB, FS, ingest. Unaware of HTTP/Tauri. |
| `@forager/server` | **new** (extracted from `@forager/web`) | Headless Deno HTTP server: RPC endpoint, `/files/...` streaming, `/thumbnail/...`, CORS, optional bearer-token auth. No SvelteKit. |
| `@forager/frontend` | **new** (extracted from `@forager/web`) | Pure Svelte 5 SPA. Same UI as today, but the `BaseController` takes a base URL + auth token. Builds to static files; no SSR. |
| `@forager/web` | re-used as a thin server | Becomes "@forager/server + static-frontend mount." Existing CI consumers (e.g. JSR publish, current CLI `gui` flow without Tauri) keep working. Internally it embeds `@forager/server` and serves the built `@forager/frontend` as static assets at `/`. |
| `@forager/desktop` | **new** | The Tauri app. Bundles `@forager/frontend` as `frontendDist`. The only logic in Rust-land is window/menu/IPC plumbing; no Forager logic. |
| `@forager/cli` | updated | Gains `serve`, `gui` (Tauri), `gui --serve-local` (spawns both). |

This is deliberately conservative: it factors the existing app along its natural seam (SPA ↔ HTTP) rather than rewriting anything. The browser-based experience keeps working; the Tauri experience is the same SPA pointed at a configurable origin.

### Why not keep SvelteKit and just wrap it in a webview?

A Tauri app pointing its `webview` at `http://127.0.0.1:8000` (the existing SvelteKit server) is the laziest option, and it _does_ partially satisfy the brief — but:

- It still needs the SvelteKit server to run on the user's machine even when "remote mode" is selected, which contradicts the goal of "talk to Forager on another machine."
- It throws away the main reason to use Tauri: a real native window with proper menus, drag/drop, deep-linking, system tray, file pickers, etc.
- It complicates `--serve-local` semantics (now there are _two_ HTTP servers: the SvelteKit one for HTML and the user's local Forager).

The cleaner split is to make the SPA shippable as static files and let either Tauri or the Deno server host them.

### Why Svelte but maybe not SvelteKit?

SvelteKit's value here was the routing, the +server endpoints, and the production adapter. Once we move `/rpc` and `/files` into `@forager/server`, the only thing left of SvelteKit is client-side routing and the page/load conventions. Two viable options:

1. **Drop SvelteKit, use Vite + Svelte 5 + a small router** (e.g. `svelte-routing` or `@mateothegreat/svelte5-router`). Smallest runtime, simplest Tauri integration, but requires re-writing `+page.svelte`/`+layout.svelte` into router components.
2. **Keep SvelteKit but use the `static` adapter** (`@sveltejs/adapter-static`) with `ssr=false` + `prerender=true` on the root layout (already partly true: see `+layout.ts` and `+layout.server.ts`). All existing routes (`/browse`, `/tags`, `/tags/[slug]`) stay where they are; SvelteKit just emits a SPA shell. Slightly heavier runtime, but no UI rewrite.

**Recommendation: option 2 first.** It preserves the existing routing/components and removes the custom Deno adapter entirely. We can revisit option 1 only if SvelteKit's static adapter conflicts with Tauri (it generally doesn't).

## 4. New `@forager/server` package

Lifted almost entirely from existing code:

- `packages/web/src/routes/rpc/[signature]/+server.ts` → a Deno `Deno.serve` route in `@forager/server`.
- `packages/web/src/routes/files/media_file/[id]/+server.ts` and `…/thumbnail/[id]/+server.ts` → same, with the request/response objects swapped from `RequestEvent` to plain `Request`.
- `packages/web/src/hooks.server.ts` → a `ForagerServer` class that owns the single `Forager` instance.
- `packages/web/src/lib/api.ts` → moves verbatim; only the import of `@andykais/ts-rpc/adapters/sveltekit.ts` is swapped for the generic `adapters/mod.ts` (or a hand-rolled `Request → Response` adapter, since the SvelteKit adapter is a one-screen file).

New responsibilities the standalone server needs:

1. **CORS** — Tauri's webview uses a custom scheme (`tauri://localhost` or `http://tauri.localhost`); the server must allow it. Same for arbitrary LAN origins if the user opens `http://my-nas:8000` in a browser. Configurable allow-list via `forager.yaml`.
2. **Range requests / streaming** — already implemented today; carried over as-is.
3. **Always serve the static frontend** — even when invoked via `forager serve`, the server mounts the built SPA at `/`. There's no real downside to leaving the HTML reachable: the static bytes are already in the binary's asset folder, the route doesn't touch any private state, and it avoids a second config knob plus a second "mode" of the server. If the user wants the Tauri client to talk to a server that doesn't serve HTML, they simply don't open the URL in a browser. Auth/access-control is explicitly out of scope here and is being designed separately.

Public surface of `@forager/server`:

```ts
import { ForagerServer } from '@forager/server'

const server = new ForagerServer({
  forager,                    // a constructed Forager instance
  config,                     // the resolved PackagesConfig
  port: 8000,
  hostname: '0.0.0.0',        // explicit, default '127.0.0.1'
  cors: { allow: ['tauri://localhost', 'http://tauri.localhost'] },
})
await server.start()
```

This is a strict superset of what `web.Server` does today; the existing `@forager/web` `Server` class becomes a thin wrapper around it.

## 5. Refactored `@forager/frontend`

The SPA we ship to both Tauri and the browser. Concretely:

- Move `packages/web/src` (minus `routes/files/*`, `routes/rpc/*`, and `hooks.server.ts`) into `packages/frontend/src`. The `routes/files/*` and `routes/rpc/*` directories disappear from the frontend entirely.
- Switch the SvelteKit adapter from the custom `./adapter/adapter.js` to `@sveltejs/adapter-static`. Set `ssr=false`, `prerender=true` for the root, and a `fallback: 'index.html'` so client-side routing handles unknown paths.
- Introduce a small `frontend/src/lib/connection.ts` module that resolves the API base URL at runtime, using this order:
  1. `window.__FORAGER_CONNECTION__` (injected by Tauri at startup — see §7).
  2. URL query string (`?api=https://example.com`) — useful for the browser-served case too.
  3. Built-in default: same origin (current behaviour).
- `BaseController` is updated to take a `connection` instead of constructing its own:

  ```ts
  constructor(config: Config, connection: Connection) {
    this.client = rpc.create<ApiSpec>(`${connection.base_url}/rpc/:signature`)
    this.media_url = (id: number) => `${connection.base_url}/files/media_file/${id}`
    this.thumbnail_url = (id: number, index = 0) =>
      `${connection.base_url}/files/thumbnail/${id}?index=${index}`
  }
  ```

- All hard-coded `/files/...` strings in `MediaView.svelte` and `media_view_rune.svelte.ts` move behind `controller.media_url(...)` / `controller.thumbnail_url(...)`. This is the only invasive frontend change.

The pre-existing `+layout.server.ts` and `+page.server.ts` that exist purely to redirect or pass `config` need to be reworked:

- `/+page.server.ts` (current `redirect(307, '/browse')`) → `+page.ts` with a client-side `goto('/browse')`. Trivial.
- `/+layout.server.ts` (current `return { config: event.locals.config }`) → `+layout.ts` that fetches `client.config()` over RPC. We already have an RPC method for it (`Api::config`).

## 6. Media + thumbnail streaming, remote-mode

This is the only real correctness pitfall. Today the SvelteKit handler does:

```ts
const filepath = media.media_file.filepath
...
const file = await Deno.open(absolute_path, { read: true })
```

When the Tauri app talks to a _remote_ Forager, the file lives on the remote machine, but the `<video>` element is local. The first-cut answer is **always proxy through HTTP**: both browser and Tauri webview point `<video src>` and `<img src>` at the remote `@forager/server`'s `/files/...` endpoints. Range requests already work. This is what the architecture above assumes, and funneling every URL through `controller.media_url(...)` / `controller.thumbnail_url(...)` is sufficient.

**Future consideration — Tauri custom URI scheme for local-only.** When `--serve-local` is in play, the Tauri app could register a `forager-media://` scheme handler in Rust that reads files directly off disk and skips HTTP entirely. Worth keeping in mind so the abstraction stays compatible, but explicitly out of scope for the first cut.

## 7. `@forager/desktop` (the Tauri app)

Structure:

```
packages/desktop/
├── deno.json                    # tasks: dev, build
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       └── lib.rs               # invoke handlers
└── README.md                    # how to install Rust toolchain
```

Key Tauri config decisions:

- `frontendDist`: points at the built `@forager/frontend` (e.g. `../frontend/build`).
- `devUrl`: points at a Vite dev server. We add a `deno task --cwd packages/frontend dev` script and let Tauri's `beforeDevCommand` spawn it.
- `withGlobalTauri: true` so the frontend can call `window.__TAURI__.invoke(...)` without importing the JS bridge as an npm module (avoids a dependency on the Tauri JS API package in the Svelte build, which is fiddlier under Deno + Vite).
- Capability allow-list intentionally tiny: at minimum the `shell:default` for opening files in the OS, plus an invoke handler for "give me the connection settings."

Rust invoke handlers (kept minimal):

```rust
#[tauri::command]
fn get_connection() -> Connection { ... }   // returns { base_url }

#[tauri::command]
fn open_in_os(path: String) -> Result<(), String> { ... }
```

`get_connection` is read at frontend startup and exposed as `window.__FORAGER_CONNECTION__`, which `frontend/src/lib/connection.ts` picks up.

How the Tauri app finds the connection:

1. Read `--config` (default `~/.config/forager/forager.yml`) at startup.
2. Read `web.desktop.base_url` (see §8 schema) and expose `{ base_url }` to the frontend.
3. When the CLI launches the Tauri binary with `--serve-local`, it overrides `base_url` to `http://127.0.0.1:<port>` via env var before spawning.

## 8. Config schema additions

Today `web` config has `port`, `asset_folder`, `editing`, `logger`, `ui_defaults`, `shortcuts`. We extend it with two new subtrees, both backwards-compatible:

```yaml
web:
  # NEW: server-side knobs (used by `forager serve` and the embedded server)
  server:
    hostname: 127.0.0.1            # default unchanged
    port: 8000                     # already exists, moves under server.*
    cors_allow_origins:            # list of allowed CORS origins
      - tauri://localhost
      - http://tauri.localhost

  # NEW: client-side connection settings (used by Tauri `forager gui`)
  desktop:
    base_url: http://127.0.0.1:8000

  # existing keys stay where they are
  editing: ...
  logger: ...
  ui_defaults: ...
  shortcuts: ...
```

Schema work (`packages/frontend/src/lib/server/config.ts`, formerly `packages/web/src/lib/server/config.ts`):

- Add Zod schemas for `WebServer` and `WebDesktop` blocks.
- Keep `port` at the top level of `web` working via a `.transform()` that hoists it into `web.server.port` when the new key is absent. This preserves all existing `forager.yml` files in the wild.

The `core.thumbnails.folder` and `core.database.folder` paths obviously only need to exist on the server-side host; for the desktop client we'll skip validating those paths when the config is loaded by the Tauri app (the resolved `core` block is only needed by `forager serve`).

## 9. CLI changes

The existing `init`, `search`, `discover`, `create`, `delete` commands stay as-is. We add and reshape:

### `forager serve`

```text
forager serve [--port N] [--hostname H]
```

- Builds a `Forager` (current `launch_forager()` flow).
- Constructs `@forager/server`'s `ForagerServer` with the resolved config and CLI overrides.
- Blocks until shutdown signal.

### `forager gui`

```text
forager gui [--serve-local] [--port N]
```

- Without flags: launches the Tauri app pointed at `web.desktop.base_url`.
- `--serve-local`: also spawn `forager serve` (in-process or as a child process — see below) and override `base_url` for that run to `http://127.0.0.1:<port>`.

Implementation notes:

- The Tauri binary itself can't be compiled by `deno compile`. There are two ways to integrate:
  1. **Sidecar/external binary.** Tauri builds produce a platform-specific binary; `forager gui` looks for it on `$PATH` (or alongside the CLI binary) and spawns it. The CLI passes connection info via env vars or a short-lived config file path. This is the cleanest and the one we'd ship.
  2. **Bundle inside the CLI.** Tauri does not support being embedded in another binary. So (1) is effectively forced. We'll just document that `forager-gui-<platform>` is a separate downloadable binary and `forager gui` knows how to find it.
- `--serve-local`: implemented as two child processes — the CLI keeps owning the `Forager` lifecycle in-process (running `ForagerServer` directly), then `spawn`s the Tauri binary and waits on both. On any one exiting, the other gets a graceful shutdown.

### CI / release impact

- `packages/cli`'s compile tasks stay the same.
- `packages/desktop` adds one new GitHub Actions job (Linux) that runs `tauri build` and attaches the produced binary to releases. Rust toolchain + `libwebkit2gtk` required; this is the biggest CI footprint change. macOS and Windows builds are deferred until the Linux flow is stable.

## 10. Phased rollout

Each phase ends in a buildable, testable state. None of them break the current browser experience.

**Phase 1 — Extract `@forager/server` without touching the UI.**
- Move `/rpc` and `/files` handlers out of SvelteKit into a new `packages/server` package.
- `@forager/web` becomes a thin wrapper that runs `ForagerServer` + serves SvelteKit assets exactly as today.
- Existing `forager gui` keeps working unchanged. Verify by running `deno task develop` and clicking around.

**Phase 2 — Frontend refactor for configurable connection.**
- Introduce `connection.ts` and thread it through `BaseController`.
- Replace hardcoded `/files/...` strings with `controller.media_url(...)`.
- Still SvelteKit, still served by `@forager/web`. Browser experience: identical.

**Phase 3 — Static SPA build.**
- Swap the SvelteKit adapter to `adapter-static`.
- Delete the custom `packages/web/adapter/` directory (or repurpose it for a transition period).
- `@forager/server` now serves `frontend/build/` as static files.
- This is also when `packages/web` either becomes a tiny façade or is removed in favor of `packages/server` + `packages/frontend`. Keep it around with deprecation notice if external consumers depend on the JSR package.

**Phase 4 — Config schema extensions.**
- Add `web.server.*` and `web.desktop.*` blocks.
- Backwards-compat transforms for the legacy `web.port` location.
- CLI `serve` command lands here.

**Phase 5 — `@forager/desktop` Tauri shell.**
- Scaffold via `cargo create-tauri-app` (or `pnpm create tauri-app` if we want the JS bindings — we don't, see §7).
- Wire `beforeDevCommand` to `deno task --cwd packages/frontend dev`, `beforeBuildCommand` to `deno task --cwd packages/frontend build`, `frontendDist` to `../frontend/build`.
- Implement the two invoke handlers (`get_connection`, `open_in_os`).
- Manual test: `cargo tauri dev` opens a window pointed at a `forager serve` running on the same machine.

**Phase 6 — CLI `gui` switches to Tauri sidecar.**
- `forager gui` discovers the Tauri binary and `spawn`s it with `base_url` (resolved from config or `--serve-local`) passed in via env.
- `--serve-local` flag.
- Release pipeline updated to ship `forager-gui-linux` alongside the CLI.

**Phase 7 (optional) — Tauri-only optimizations.**
- Custom URI scheme for local-mode media (skip HTTP).
- System tray, native file picker for "import here," global media keys, etc. None of these affect the architecture above.

## 11. Risks / open questions

Initial target is **Linux only**; macOS/Windows are explicitly out of scope for the first cut.

1. **Deno + Tauri dev ergonomics.** Tauri assumes Node-ish tooling. Vite + Deno works (it's already in use), but the `beforeDevCommand` invocation needs `deno` on PATH in dev environments. Worth verifying early in Phase 5 that `tauri dev` and `tauri build` cleanly drive a Deno-based Vite build.
2. **CORS preflight for RPC.** `@andykais/ts-rpc` does `PUT` requests with JSON bodies, which is preflighted by browsers. The server needs to handle `OPTIONS` correctly for any cross-origin client. Not hard, but easy to forget.
3. **`@forager/web` JSR consumers.** The package is published to JSR and consumed by `@forager/cli`. If we delete it, downstream tooling breaks. Easier path: keep `@forager/web` as a façade re-exporting `Server` from `@forager/server`. Plan accordingly in Phase 3.
4. **CI binary distribution.** The current release flow only ships the Deno-compiled CLI binaries. Adding Tauri increases artifact size and OS-specific complexity. For an experimental Linux-first project we can ship unsigned binaries to start.

## 12. Summary of files & packages touched

For quick reviewer reference:

| Area | New | Modified | Removed |
| --- | --- | --- | --- |
| `packages/server/**` | all | — | — |
| `packages/frontend/**` | all (largely moved from `packages/web/src/**`) | — | — |
| `packages/desktop/**` | all | — | — |
| `packages/web/src/routes/files/**` | — | — | moved into `packages/server` |
| `packages/web/src/routes/rpc/**` | — | — | moved into `packages/server` |
| `packages/web/src/hooks.server.ts` | — | — | replaced by `ForagerServer` |
| `packages/web/svelte.config.js` | — | swap adapter | — |
| `packages/web/adapter/**` | — | — | removed once Phase 3 lands |
| `packages/web/src/lib/server/config.ts` | — | add `web.server`, `web.desktop`; backcompat for legacy `web.port` | — |
| `packages/web/src/lib/base_controller.ts` | — | take `Connection`; build URLs via it | — |
| `packages/web/src/lib/runes/media_view_rune.svelte.ts` | — | use `controller.thumbnail_url(...)` | — |
| `packages/web/src/routes/browse/components/MediaView.svelte` | — | use `controller.media_url(...)` / `controller.thumbnail_url(...)` | — |
| `packages/cli/src/cli.ts` | add `serve`; rework `gui` for Tauri + `--serve-local` | — | — |
| `packages/cli/src/inputs.ts` | — | re-export from `@forager/server` config | — |
| `.github/workflows/*` | new Tauri build workflow | — | — |

