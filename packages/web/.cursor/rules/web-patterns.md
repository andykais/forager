# @forager/web Patterns

## Svelte 5 Runes

### File Extensions

Files that use `$state`, `$derived`, `$effect`, or other Svelte 5 runes **must** use the `.svelte.ts` extension (not plain `.ts`). This includes controller files and rune files. Using `$state` in a `.ts` file will cause the runtime error:

```
Uncaught Svelte error: rune_outside_svelte
The `$state` rune is only available inside `.svelte` and `.svelte.js/ts` files
```

Examples of files that need `.svelte.ts`:
- `controller.svelte.ts` (uses `$state` for reactive properties)
- `runes/queryparams.svelte.ts` (uses `$state` for search results)

Files that do NOT need `.svelte.ts`:
- `controller.ts` files that don't use any runes (e.g. `packages/web/src/routes/tags/controller.ts`)

## SvelteKit Navigation Patterns

### Page Param Reactivity

When a SvelteKit page component needs to react to route param changes (e.g. `/tags/[slug]`), use `{#key}` to fully reset the page:

```svelte
<script>
  import { page } from '$app/state'
  let slug = $derived(decodeURIComponent(page.params.slug))
</script>

{#key slug}
  {@const controller = new Controller(props.data.config, slug)}
  <!-- page content -->
{/key}
```

**Do NOT use `onMount`** for loading data based on route params — it only fires once when the component mounts. Client-side navigations between different params (e.g. clicking a link from `/tags/foo` to `/tags/bar`) reuse the same component instance without re-running `onMount`.

**`$effect` is a partial solution** — it re-runs the data fetch but doesn't reset form inputs, component state, or child component state. `{#key}` destroys and recreates everything inside it, giving a clean slate.

## Controller Pattern

Controllers extend `BaseController` and are instantiated per-page. They hold:
- `runes` object with reactive state (focus, settings, queryparams)
- Handler methods for RPC calls
- The RPC `client` (inherited from `BaseController`)

For pages with URL-synced search state, use `BaseQueryParams` from `$lib/runes/base_queryparams.svelte.ts`.

## CSS Patterns

### `display: contents` for Grid-Through-Slot Layouts

When a parent uses CSS grid and children are rendered via Svelte slots/snippets, `display: contents` on the wrapper makes the slot's children become direct grid items:

```svelte
<!-- Parent uses grid -->
<header style="display: grid; grid-template-columns: auto 1fr">
  <nav>...</nav>
  <div class="contents">
    {@render children?.()}
  </div>
</header>

<!-- Child form uses display: contents to participate in parent grid -->
<form class="contents">
  <div><!-- sits in column 2 next to nav --></div>
  <div style="grid-column: 1 / -1"><!-- spans full width --></div>
</form>
```

## URL Encoding

Tag slugs contain only `[a-z0-9_:]` which are all valid URL path characters. Do **not** use `encodeURIComponent` for tag slugs in URLs — it encodes `:` to `%3A` which looks wrong. Use the slug directly:

```svelte
<!-- Good -->
<a href="/tags/{tag.slug}">

<!-- Bad — produces /tags/genre%3Aadventure -->
<a href="/tags/{encodeURIComponent(tag.slug)}">
```
