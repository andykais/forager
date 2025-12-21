<script lang="ts">
  import * as theme from '$lib/theme.ts'
  import SearchParams from './SearchParams.svelte'
  import type { MediaListPageController } from '$lib/pages/media_list/controller.ts'
  import Icon from '$lib/components/Icon.svelte'
  import { Filter, ChevronUp, ChevronDown } from '$lib/icons/mod.ts'
  import TagAutoCompleteInput from "$lib/components/TagAutoCompleteInput.svelte";

  let {controller, height = $bindable()}: {controller: MediaListPageController; height: number} = $props()
  let { dimensions, queryparams } = controller.runes

</script>

<header class="drop-shadow-md bg-gray-700 flex justify-center border-b-slate-800 border-b-2 relative z-10" bind:clientHeight={height}>
  <title>{queryparams.human_readable_summary || 'Forager'}</title>
  <SearchParams {controller} />
</header>
