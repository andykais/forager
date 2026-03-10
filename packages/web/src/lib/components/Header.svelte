<script lang="ts">
  import { page } from '$app/state'
  import * as theme from '$lib/theme.ts'
  import type { SvelteHTMLElements } from 'svelte/elements';

  let {
    height = $bindable(),
    ...props
  }: {
    title: string
    children: SvelteHTMLElements['div']['children']
  } = $props()

  const nav_items = [
    { href: '/browse', label: 'Browse' },
    { href: '/tags', label: 'Tags' },
  ]
</script>

<header
  class="drop-shadow-md bg-gray-700 flex items-center border-b-slate-700 border-b-2 relative z-10"
  bind:clientHeight={height}
  >
  <nav class="flex items-center gap-0 shrink-0 border-r border-slate-600 px-2">
    {#each nav_items as item}
      <a
        href={item.href}
        class={[
          "px-3 py-2 text-sm transition-colors rounded-md",
          page.url.pathname.startsWith(item.href)
            ? "text-slate-200 bg-slate-600"
            : "text-slate-500 hover:text-slate-300 hover:bg-gray-650",
        ]}
      >{item.label}</a>
    {/each}
  </nav>
  <title>{props.title}</title>
  <div class="flex-grow flex justify-center items-center">
    {@render props.children?.()}
  </div>
</header>
