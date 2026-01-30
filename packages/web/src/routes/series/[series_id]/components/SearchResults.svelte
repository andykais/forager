<script lang="ts">
  import type { SeriesController } from '../controller.ts'
  import MediaTile from '$lib/components/browse_media/MediaTile.svelte'

  interface Props {
    controller: SeriesController
  }

  let {controller}: Props = $props()
  const {settings, media_list} = controller.runes
</script>

<style>
  .container-masonry {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--thumbnail-size), 1fr));
    justify-items: center;
  }
</style>

<div class="container-masonry p-4" style="--thumbnail-size: {settings.ui.media_list.thumbnail_size}px">
  {#each media_list.results as result, result_index}
    <MediaTile {controller} {result} {result_index}>
      {#snippet metadata({ result })}
        {#if result.series_index !== undefined}
          <div class="text-xs text-center text-gray-500">
            #{result.series_index}
          </div>
        {/if}
      {/snippet}
    </MediaTile>
  {/each}
</div>
{#if media_list.loading}
  Loading...
{/if}
