<script lang="ts">
  import * as svelte from 'svelte'
  import Scroller from '$lib/components/Scroller.svelte'
  import Sidebar from './components/Sidebar.svelte'
  import SearchParams from './components/SearchParams.svelte'
  import SearchResults from './components/SearchResults.svelte'
  import Footer from './components/Footer.svelte'

  import { BrowseController } from './controller.ts'

  const controller = new BrowseController()
  svelte.onMount(controller.onMount)
  controller.runes.focus.stack({component: 'BrowsePage', focus: 'page'})

  let heights = $state({
    screen: 0,
    header: 0,
    scroller: 0,
    footer: 0,
  })
  $effect(() => {
    heights.scroller = heights.screen - heights.header - heights.footer
  })
</script>

<div class="h-dvh">
  <header bind:clientHeight={heights.header}>
    <SearchParams {controller} />
  </header>
  <div class="grid grid-cols-[auto_1fr]">
    <Sidebar {controller} />
    <Scroller
      more={() => controller.handlers.paginate_media()}
      class="overflow-y-scroll w-full focus:outline-none"
      style="height: {heights.scroller}px"
    >
      <SearchResults {controller} />
      {#if controller.runes.search.loading}
        Loading...
      {/if}
    </Scroller>
  </div>
  <Footer bind:height={heights.footer} {controller} />
</div>

<svelte:window
  on:keydown={controller.keybinds.handler}
  bind:innerHeight={heights.screen} 
/>
