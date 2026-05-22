/**
 * Connection abstraction for talking to a Forager server.
 *
 * The SPA used to assume same-origin everywhere. With the Tauri shell on
 * the horizon (and a "point my browser at a remote forager" use-case for
 * the web build), we now resolve a base URL at boot time from three
 * sources, in priority order:
 *
 *   1. `window.__FORAGER_CONNECTION__` — injected by the Tauri shell
 *      before the SPA starts up (see the Tauri port plan §7).
 *   2. `?api=https://example.com` query-string — handy for the
 *      browser-served build when you want to point a hosted SPA at a
 *      different backend.
 *   3. Same origin — the current default.
 *
 * Auth is intentionally out of scope per the design doc; the Connection
 * carries only a `base_url`.
 */

export interface Connection {
  base_url: string
}

declare global {
  interface Window {
    __FORAGER_CONNECTION__?: { base_url: string }
  }
}

function strip_trailing_slash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s
}

let cached: Connection | undefined

export function resolve_connection(): Connection {
  if (cached) return cached

  if (typeof window === 'undefined') {
    // SSR / prerender / test contexts. We never actually render against a
    // real backend here, so a placeholder is fine.
    cached = { base_url: '' }
    return cached
  }

  const injected = window.__FORAGER_CONNECTION__
  if (injected?.base_url) {
    cached = { base_url: strip_trailing_slash(injected.base_url) }
    return cached
  }

  const url_param = new URL(window.location.href).searchParams.get('api')
  if (url_param) {
    cached = { base_url: strip_trailing_slash(url_param) }
    return cached
  }

  cached = { base_url: window.location.origin }
  return cached
}

/** Reset the cached connection. Intended for tests; not used at runtime. */
export function __reset_connection_for_tests() {
  cached = undefined
}
