<script lang="ts">
  import type { MediaPageController } from '$lib/media_page_controller.ts'
  import SearchParams from './SearchParams.svelte'

  interface Props {
    controller: MediaPageController
    height?: number
  }

  let {controller, height = $bindable()}: Props = $props()
  let { queryparams } = controller.runes

  // Derive default title from controller mode
  const default_title = $derived(controller.is_series ? 'Forager - Series' : 'Forager')
</script>

<header class="drop-shadow-md bg-gray-700 flex justify-center border-b-slate-800 border-b-2 relative z-10" bind:clientHeight={height}>
  <title>{queryparams.human_readable_summary || default_title}</title>
  <SearchParams {controller} />
</header>
