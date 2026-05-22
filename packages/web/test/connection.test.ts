import { assertEquals } from 'jsr:@std/assert@^1.0.14'
import {
  __reset_connection_for_tests,
  resolve_connection,
} from '../src/lib/connection.ts'


/**
 * `connection.ts` is a tiny browser module that picks an API base URL from
 * three sources. These tests stub `globalThis.window` to exercise each
 * branch without spinning up a browser.
 */

interface FakeWindow {
  location: { href: string; origin: string }
  __FORAGER_CONNECTION__?: { base_url: string }
}

function with_window<T>(fake: FakeWindow, fn: () => T): T {
  __reset_connection_for_tests()
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any
  const had_window = 'window' in g
  const previous = g.window
  g.window = fake
  try {
    return fn()
  } finally {
    if (had_window) g.window = previous
    else delete g.window
    __reset_connection_for_tests()
  }
}


Deno.test('resolve_connection: window.__FORAGER_CONNECTION__ wins over everything else', () => {
  const c = with_window({
    location: { href: 'http://127.0.0.1:8000/browse?api=http://ignored', origin: 'http://127.0.0.1:8000' },
    __FORAGER_CONNECTION__: { base_url: 'http://my-nas.lan:9001' },
  }, () => resolve_connection())
  assertEquals(c.base_url, 'http://my-nas.lan:9001')
})

Deno.test('resolve_connection: ?api= query string wins over same-origin', () => {
  const c = with_window({
    location: { href: 'http://127.0.0.1:8000/browse?api=https://example.com', origin: 'http://127.0.0.1:8000' },
  }, () => resolve_connection())
  assertEquals(c.base_url, 'https://example.com')
})

Deno.test('resolve_connection: trailing slash is stripped from explicit base_url', () => {
  const c = with_window({
    location: { href: 'http://127.0.0.1:8000/browse', origin: 'http://127.0.0.1:8000' },
    __FORAGER_CONNECTION__: { base_url: 'http://my-nas.lan:9001/' },
  }, () => resolve_connection())
  assertEquals(c.base_url, 'http://my-nas.lan:9001')
})

Deno.test('resolve_connection: trailing slash is stripped from ?api= query string', () => {
  const c = with_window({
    location: { href: 'http://127.0.0.1:8000/browse?api=https://example.com/', origin: 'http://127.0.0.1:8000' },
  }, () => resolve_connection())
  assertEquals(c.base_url, 'https://example.com')
})

Deno.test('resolve_connection: falls back to same origin when no overrides are set', () => {
  const c = with_window({
    location: { href: 'http://127.0.0.1:8000/browse', origin: 'http://127.0.0.1:8000' },
  }, () => resolve_connection())
  assertEquals(c.base_url, 'http://127.0.0.1:8000')
})

Deno.test('resolve_connection: empty ?api= falls back to same origin', () => {
  const c = with_window({
    location: { href: 'http://127.0.0.1:8000/browse?api=', origin: 'http://127.0.0.1:8000' },
  }, () => resolve_connection())
  assertEquals(c.base_url, 'http://127.0.0.1:8000')
})

Deno.test('resolve_connection: missing window (SSR/test) returns empty base_url placeholder', () => {
  __reset_connection_for_tests()
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any
  const had_window = 'window' in g
  const previous = g.window
  delete g.window
  try {
    const c = resolve_connection()
    assertEquals(c.base_url, '')
  } finally {
    if (had_window) g.window = previous
    __reset_connection_for_tests()
  }
})

Deno.test('resolve_connection: result is cached after first call', () => {
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any
  const had_window = 'window' in g
  const previous = g.window
  __reset_connection_for_tests()
  g.window = {
    location: { href: 'http://127.0.0.1:8000/browse', origin: 'http://127.0.0.1:8000' },
  }
  try {
    const a = resolve_connection()
    g.window.location = { href: 'http://other.example/', origin: 'http://other.example' }
    const b = resolve_connection()
    assertEquals(a, b, 'second call should return the same cached object')
  } finally {
    if (had_window) g.window = previous
    else delete g.window
    __reset_connection_for_tests()
  }
})
