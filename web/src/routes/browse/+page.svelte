<script lang="ts">
  import MediaDetails from './components/MediaDetails.svelte'
  import SearchParams from './components/SearchParams.svelte'
  import MediaList from './components/MediaList.svelte'
  import Footer from './components/Footer.svelte'

  import { BrowseController } from './controller.ts'

  const controller = new BrowseController()
  let { dimensions, focus } = controller.runes
  focus.stack({component: 'BrowsePage', focus: 'page'})
</script>

<div class="h-dvh">
  <header bind:clientHeight={dimensions.heights.header}>
    <SearchParams {controller} />
  </header>
  <div class="grid grid-cols-[auto_1fr]">
    <MediaDetails {controller} />
    <MediaList {controller} />
  </div>
  <Footer bind:height={dimensions.heights.footer} {controller} />
</div>

<svelte:window
  on:keydown={controller.keybinds.handler}
  bind:innerHeight={dimensions.heights.screen} 
/>
