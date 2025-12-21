<script lang="ts">
  import MediaDetails from '../../browse/components/MediaDetails.svelte'
  import MediaList from '../../browse/components/MediaList.svelte'
  import MediaView from '../../browse/components/MediaView.svelte'
  import Footer from '../../browse/components/Footer.svelte'
  import Header from '../../browse/components/Header.svelte'

  import { page } from '$app/state'
  import { SeriesController } from './controller.ts'

	/** @type {import('./$types').PageProps} */
  let props = $props()

  const series_id = Number.parseInt(page.params.series_id)
  const controller = new SeriesController(props.data.config, series_id)
  let { dimensions, focus } = controller.runes
  focus.stack({ component: 'SeriesPage', focus: 'page' })
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

