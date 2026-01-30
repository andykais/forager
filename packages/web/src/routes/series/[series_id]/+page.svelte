<script lang="ts">
  import MediaBrowserLayout from '$lib/components/browse_media/MediaBrowserLayout.svelte'
  import Header from './components/Header.svelte'
  import MediaList from './components/MediaList.svelte'
  import { SeriesController } from './controller.ts'

	/** @type {import('./$types').PageProps} */
  let props  = $props()

  const series_id = parseInt(props.params.series_id)
  const controller = new SeriesController(props.data.config, series_id)
  let { dimensions, focus } = controller.runes
  focus.stack({component: 'SeriesPage', focus: 'page'})
</script>

<MediaBrowserLayout {controller}>
  {#snippet header({ controller })}
    <Header {controller} bind:height={dimensions.heights.header} />
  {/snippet}

  {#snippet media_list({ controller })}
    <MediaList {controller} />
  {/snippet}
</MediaBrowserLayout>
