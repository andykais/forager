<script lang="ts">
  import type { Snippet } from 'svelte'
  import Scroller from '$lib/components/Scroller.svelte'
  import SearchResults from './SearchResults.svelte'
  import type { BrowsableController } from '$lib/base_controller.ts'
  import type { MediaViewRune } from '$lib/runes/index.ts'

  let {
    controller,
    tile_footer,
  }: {
    controller: BrowsableController
    tile_footer?: Snippet<[MediaViewRune]>
  } = $props()
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
    },

    Star0: () => {
      controller.runes.media_selections.current_selection.media_response?.star(0)
    },
    Star1: () => {
      controller.runes.media_selections.current_selection.media_response?.star(1)
    },
    Star2: () => {
      controller.runes.media_selections.current_selection.media_response?.star(2)
    },
    Star3: () => {
      controller.runes.media_selections.current_selection.media_response?.star(3)
    },
    Star4: () => {
      controller.runes.media_selections.current_selection.media_response?.star(4)
    },
    Star5: () => {
      controller.runes.media_selections.current_selection.media_response?.star(5)
    },
  })
</script>

<div
  bind:this={media_list_element}>
  <Scroller
    loading={controller.runes.media_list.loading}
    more={() => controller.runes.media_list.paginate()}
    class={[
      "w-full focus:outline-none",
       controller.runes.media_selections.current_selection.show ? "overflow-hidden" : "overflow-y-scroll",
    ]}
    style="height: {controller.runes.dimensions.heights.media_list}px"
  >
    <SearchResults {controller} {tile_footer} />
  </Scroller>
</div>
