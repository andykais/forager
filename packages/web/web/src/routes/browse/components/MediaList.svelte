<script lang="ts">
  import Scroller from '$lib/components/Scroller.svelte'
  import SearchResults from './SearchResults.svelte'
  import type { BrowseController } from '../controller.ts'

  let {controller}: {controller: BrowseController} = $props()
  let media_list_element: HTMLElement

  controller.keybinds.component_listen({
    NextMedia: () => {
      if (document.activeElement instanceof HTMLInputElement) {
        if (media_list_element.contains(document.activeElement)) {}
        else return
      }
      controller.runes.media_selections.next_media(controller.runes.media_list.results)
    },
    PrevMedia: () => {
      if (document.activeElement instanceof HTMLInputElement) {
        if (media_list_element.contains(document.activeElement)) {}
        else return
      }
      controller.runes.media_selections.prev_media(controller.runes.media_list.results)
    }
  })
</script>

<div
  bind:this={media_list_element}>
  <Scroller
    more={() => controller.runes.media_list.paginate()}
    class={[
      "w-full focus:outline-none",
       controller.runes.media_selections.current_selection.show ? "overflow-hidden" : "overflow-y-scroll",
    ]}
    style="height: {controller.runes.dimensions.heights.media_list}px"
  >
    <SearchResults {controller} />
  </Scroller>
</div>
