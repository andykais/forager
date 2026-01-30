<script lang="ts">
  import MediaBrowserLayout from '$lib/components/browse_media/MediaBrowserLayout.svelte'
  import Header from './components/Header.svelte'
  import MediaList from './components/MediaList.svelte'
  import { BrowseController } from './controller.ts'

	/** @type {import('./$types').PageProps} */
  let props  = $props()

  const controller = new BrowseController(props.data.config)
  let { dimensions, focus } = controller.runes
  focus.stack({component: 'BrowsePage', focus: 'page'})
</script>

<MediaBrowserLayout {controller}>
  {#snippet header({ controller })}
    <Header {controller} bind:height={dimensions.heights.header} />
  {/snippet}

  {#snippet media_list({ controller })}
    <MediaList {controller} />
  {/snippet}
</MediaBrowserLayout>
