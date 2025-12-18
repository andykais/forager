<script lang="ts">
  import MediaDetails from './components/MediaDetails.svelte'
  import SeriesSearchParams from './components/SeriesSearchParams.svelte'
  import MediaList from './components/MediaList.svelte'
  import MediaView from './components/MediaView.svelte'
  import Footer from './components/Footer.svelte'
  import Header from './components/Header.svelte'

  import { SeriesController } from './controller.ts'

  /** @type {import('./$types').PageProps} */
  let props = $props()

  const series_id = parseInt(props.params.series_id)
  const controller = new SeriesController(props.data.config, series_id)
  let { dimensions, focus, queryparams } = controller.runes
  focus.stack({component: 'SeriesPage', focus: 'page'})
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
