<script lang="ts">
  import Sidebar from './components/Sidebar.svelte'
  import SearchParams from './components/SearchParams.svelte'
  import MediaList from './components/MediaList.svelte'
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
    <MediaList {controller} />
  </div>
  <Footer bind:height={dimensions.heights.footer} {controller} />
</div>

<svelte:window
  on:keydown={controller.keybinds.handler}
  bind:innerHeight={dimensions.heights.screen} 
/>
