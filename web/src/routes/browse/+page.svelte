<script lang="ts">
  import Scroller from '$lib/components/Scroller.svelte'
  import Sidebar from './components/Sidebar.svelte'
  import SearchParams from './components/SearchParams.svelte'
  import SearchResults from './components/SearchResults.svelte'
  import Footer from './components/Footer.svelte'

  import { BrowseController } from './controller.ts'

  const controller = new BrowseController()
  controller.runes.focus.stack({component: 'BrowsePage', focus: 'page'})
  let { dimensions } = controller.runes
</script>

<div class="h-dvh">
  <header bind:clientHeight={dimensions.heights.header}>
    <SearchParams {controller} />
  </header>
  <div class="grid grid-cols-[auto_1fr]">
    <Sidebar {controller} />
    <Scroller
      more={() => controller.handlers.paginate_media()}
      class={[
        "w-full focus:outline-none",
         controller.runes.media_selections.current_selection.show ? "overflow-hidden" : "overflow-y-scroll",
      ]}
      style="height: {dimensions.heights.media_list}px"
    >
      <SearchResults {controller} />
    </Scroller>
  </div>
  <Footer bind:height={dimensions.heights.footer} {controller} />
</div>

<svelte:window
  on:keydown={controller.keybinds.handler}
  bind:innerHeight={dimensions.heights.screen} 
/>
