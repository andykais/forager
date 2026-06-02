import { goto } from '$app/navigation'
import { browser } from '$app/environment'


// `/browse` is the real home — `/` only exists to redirect into it. Phase 3
// dropped the SSR layer, so this used to be a `+page.server.ts` redirect.
export function load() {
  if (browser) {
    goto('/browse', { replaceState: true })
  }
  return {}
}
