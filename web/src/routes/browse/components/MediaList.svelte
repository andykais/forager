<script lang="ts">
  import Scroller from '$lib/components/Scroller.svelte'
  import SearchResults from './SearchResults.svelte'
  import type { BrowseController } from '../controller.ts'

  let {controller}: {controller: BrowseController} = $props()
</script>

<Scroller
  more={() => controller.handlers.paginate_media()}
  class={[
    "w-full focus:outline-none",
     controller.runes.media_selections.current_selection.show ? "overflow-hidden" : "overflow-y-scroll",
  ]}
  style="height: {controller.runes.dimensions.heights.media_list}px"
>
  <SearchResults {controller} />
</Scroller>
