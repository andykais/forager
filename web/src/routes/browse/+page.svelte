<script lang="ts">
  import MediaDetails from './components/MediaDetails.svelte'
  import SearchParams from './components/SearchParams.svelte'
  import MediaList from './components/MediaList.svelte'
  import MediaView from './components/MediaView.svelte'
  import Footer from './components/Footer.svelte'
  import Header from './components/Header.svelte'

  import { BrowseController } from './controller.ts'

	/** @type {import('./$types').PageProps} */
  let props  = $props()

  const controller = new BrowseController(props.data.config)
  let { dimensions, focus, queryparams } = controller.runes
  focus.stack({component: 'BrowsePage', focus: 'page'})
</script>

<div class="h-dvh">
  <Header {controller} bind:height={dimensions.heights.header} />
  <div class="grid grid-cols-[auto_1fr]">
    <MediaDetails {controller} />
    <div class="relative">
      <MediaView {controller} />
      <MediaList {controller} />
    </div>
  </div>
  <Footer {controller} bind:height={dimensions.heights.footer} />
</div>

<svelte:window
  on:keydown={controller.keybinds.handler}
  bind:innerHeight={dimensions.heights.screen} 
/>
