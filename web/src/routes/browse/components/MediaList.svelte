<script lang="ts">
  import Scroller from '$lib/components/Scroller.svelte'
  import SearchResults from './SearchResults.svelte'
  import MediaView from './MediaView.svelte'
  import type { BrowseController } from '../controller.ts'

  let {controller}: {controller: BrowseController} = $props()

  controller.keybinds.component_listen({
    NextMedia: () => {
      controller.runes.media_selections.next_media(controller.runes.search.results)
    },
    PrevMedia: () => {
      controller.runes.media_selections.prev_media(controller.runes.search.results)
    }
  })
</script>

<Scroller
  more={() => controller.handlers.paginate_media()}
  class={[
    "w-full focus:outline-none",
     controller.runes.media_selections.current_selection.show ? "overflow-hidden" : "overflow-y-scroll",
  ]}
  style="height: {controller.runes.dimensions.heights.media_list}px"
>
  <MediaView {controller} />
  <SearchResults {controller} />
</Scroller>
