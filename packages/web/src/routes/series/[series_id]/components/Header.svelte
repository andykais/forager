<script lang="ts">
  import * as theme from '$lib/theme.ts'
  import SearchParams from './SearchParams.svelte'
  import type { SeriesController } from '../controller.ts'

  let {controller, height = $bindable()}: {controller: SeriesController; height: number} = $props()
  let { queryparams } = controller.runes

</script>

<header class="drop-shadow-md bg-gray-700 flex justify-center border-b-slate-800 border-b-2 relative z-10" bind:clientHeight={height}>
  <title>{queryparams.human_readable_summary || 'Forager Series'}</title>
  <SearchParams {controller} />
</header>
