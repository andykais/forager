<script lang="ts" module>
  import type { BrowseController } from '../../routes/browse/controller.ts'
  import type { SeriesController } from '../../routes/series/[series_id]/controller.ts'

  export type MediaBrowserController = BrowseController | SeriesController
</script>

<script lang="ts">
  import MediaDetails from '../../routes/browse/components/MediaDetails.svelte'
  import MediaView from '../../routes/browse/components/MediaView.svelte'
  import Footer from '../../routes/browse/components/Footer.svelte'
  import type { Snippet } from 'svelte'

  interface Props {
    controller: MediaBrowserController
    header: Snippet<[{ controller: MediaBrowserController }]>
    media_list: Snippet<[{ controller: MediaBrowserController }]>
  }

  let { controller, header, media_list }: Props = $props()
  let { dimensions } = controller.runes
</script>

<div class="h-dvh">
  {@render header({ controller })}
  <div class="grid grid-cols-[auto_1fr]">
    <MediaDetails {controller} />
    <div class="relative">
      <MediaView {controller} />
      {@render media_list({ controller })}
    </div>
  </div>
  <Footer {controller} bind:height={dimensions.heights.footer} />
</div>

<svelte:window
  on:keydown={controller.keybinds.handler}
  bind:innerHeight={dimensions.heights.screen}
/>
