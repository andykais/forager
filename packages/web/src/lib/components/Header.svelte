<script lang="ts">
  import * as theme from '$lib/theme.ts'
  import type { SvelteHTMLElements } from 'svelte/elements';
  import Icon from '$lib/components/Icon.svelte'
  import { Bars3 } from '$lib/icons/mod.ts'

  let {
    height = $bindable(),
    ...props
  }: {
    title: string
    children: SvelteHTMLElements['div']['children']
  } = $props()

  const icon_color = theme.colors.gray[800]
  const icon_size = "32px"
</script>

<header
  class="drop-shadow-md bg-gray-700 flex justify-center items-center border-b-slate-700 border-b-2 relative z-10"
  bind:clientHeight={height}
  >
  <title>{props.title}</title>
  {@render props.children?.()}
</header>
