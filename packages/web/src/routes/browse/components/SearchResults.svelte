<script lang="ts">
  import type { BrowseController } from '../controller.ts'
  import MediaTile from '$lib/components/browse_media/MediaTile.svelte'
  import SearchLink from './SearchLink.svelte'

  interface Props {
    controller: BrowseController
  }

  let {controller}: Props = $props()
  const {queryparams, settings, media_list} = controller.runes
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
        {#if result.media_type === 'media_series'}
          <a
            href="/series/{result.media_reference.id}"
            class="text-xs text-center text-gray-500 hover:text-green-500 hover:bg-gray-700 px-1 rounded-sm text-nowrap truncate"
            title={result.media_reference.title}
          >
            {result.media_reference.title}
          </a>
        {:else if result.media_type === 'grouped'}
          <SearchLink
            class="text-xs text-center text-gray-500 hover:text-green-500 hover:bg-gray-700 px-2 rounded-sm"
            {controller}
            params={queryparams.merge({mode: 'media', tags: `${queryparams.current.group_by ?? ''}:${result.group_metadata.value}`})}
          >
            {result.group_metadata.value}
          </SearchLink>
        {/if}
      {/snippet}
    </MediaTile>
  {/each}
</div>
{#if media_list.loading}
  Loading...
{/if}
