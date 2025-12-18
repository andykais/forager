<script lang="ts">
  import * as theme from '$lib/theme.ts'
  import SeriesSearchParams from './SeriesSearchParams.svelte'
  import type { SeriesController } from '../controller.ts'
  import Icon from '$lib/components/Icon.svelte'
  import { Filter, ChevronUp, ChevronDown } from '$lib/icons/mod.ts'

  let {controller, height = $bindable()}: {controller: SeriesController; height: number} = $props()
  let { dimensions, queryparams } = controller.runes

</script>

<header class="drop-shadow-md bg-gray-700 flex justify-center border-b-slate-800 border-b-2 relative z-10" bind:clientHeight={height}>
  <title>{queryparams.human_readable_summary || 'Forager - Series'}</title>
  <SeriesSearchParams {controller} />
</header>
