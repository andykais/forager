<script lang="ts">
  import MediaDetails from './components/MediaDetails.svelte'
  import SearchParams from './components/SearchParams.svelte'
  import MediaList from './components/MediaList.svelte'
  import MediaView from './components/MediaView.svelte'
  import Footer from './components/Footer.svelte'
  import Header from '$lib/components/Header.svelte'

  import { BrowseController } from './controller.ts'
  import { set_controller } from '$lib/contexts/controller.ts'

	/** @type {import('./$types').PageProps} */
  let props  = $props()

  const controller = set_controller(new BrowseController(props.data.config))
  let { dimensions, focus, queryparams } = controller.runes
  focus.stack({component: 'BrowsePage', focus: 'page'})
</script>

<div class="h-dvh">
  <Header title={queryparams.human_readable_summary || 'Forager'} bind:height={dimensions.heights.header} >
    <SearchParams />
  </Header>
  <div class="grid grid-cols-[auto_1fr]">
    <MediaDetails />
    <div class="relative">
      <MediaView />
      <MediaList />
    </div>
  </div>
  <Footer bind:height={dimensions.heights.footer} />
</div>

<svelte:window
  on:keydown|capture={controller.keybinds.handler}
  bind:innerHeight={dimensions.heights.screen} 
/>
