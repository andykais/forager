<script lang="ts">
  import type { BrowseController } from '../controller.ts'
  import type { Forager } from '@forager/core'
  import * as theme from '$lib/theme.ts'
  import { focusable } from '$lib/actions/mod.ts'
  import Icon from '$lib/components/Icon.svelte'
  import { PlayCircle, Photo, Gif, Music } from '$lib/icons/mod.ts'

  interface Props {
    controller: BrowseController
  }

  let {controller }: Props = $props()

  let tile_size = controller.runes.settings.ui.media_list.thumbnail_size
  const icon_size = 14
  const icon_color = theme.colors.green[200]
  const media_selections = controller.runes.media_selections
  let dialog: HTMLDialogElement

</script>

<style>
  .container-masonry {
    display: grid;
    grid-gap: 10px;
    grid-column-gap: 15px;
    grid-template-columns: repeat(auto-fill, minmax(var(--thumbnail-size), 1fr));
  }

  .container-media-tile {
    display: grid;
    gap: 5px;
    grid-template-rows: 1fr max-content;
    height: 100%;
    width: 100%;
    align-items: center;
  }
</style>



<div class="container-masonry p-4" style="--thumbnail-size: {tile_size}px">
  {#each controller.runes.search.results as result, result_index}
    {#if result.media_type === 'media_file'}
      <div>
      <button 
        type="button"
        class="inline-flex items-center justify-center p-1
               outline-none"
        use:focusable={!media_selections.current_selection.show && media_selections.current_selection.result_index === result_index}
        onclick={e => media_selections.set_current_selection(result, result_index)}>
        <div class="container-media-tile" style="width:{tile_size}px">
          <div
            class="grid justify-items-center items-center overflow-hidden
                   border-2 shadow shadow-gray-700 rounded-md"
            class:hover:border-slate-400={result.media_reference.id !== media_selections.current_selection.media_response?.media_reference.id}
            class:border-slate-900={result.media_reference.id !== media_selections.current_selection.media_response?.media_reference.id}
            class:border-green-300={result.media_reference.id === media_selections.current_selection.media_response?.media_reference.id}
            style="width:{tile_size}px; height: {tile_size}px">
            <img
              class="w-full h-full object-cover"
              src="/files/thumbnail{result.thumbnails.results[0].filepath}"
              alt="Failed to load /files/thumbnail{result.thumbnails.results[0].filepath}"/>
          </div>

          <!-- info chips -->
          <div class="flex justify-end bg-gray-700 border-1 border-slate-800 shadow shadow-gray-700 rounded-md p-0.5">
            {#if result.media_file.media_type === 'VIDEO'}
              <Icon data={PlayCircle} fill={icon_color} stroke="none" size={icon_size} />
            {:else if result.media_file.media_type === 'IMAGE' && result.media_file.content_type === 'image/gif'}
              <Icon data={Gif} fill={icon_color} stroke="none" size={icon_size} />
            {:else if result.media_file.media_type === 'IMAGE'}
              <Icon data={Photo} fill={icon_color} stroke="none" size={icon_size} />
            {:else if result.media_file.media_type === 'AUDIO'}
              <Icon data={Music} fill={icon_color} stroke="none" size={icon_size} />
            {:else}
              unknown media type {result.media_file.media_type}
            {/if}
          </div>
        </div>
      </button>
      </div>
    {:else}
      <div>unimplemented</div>
    {/if}
  {/each}
</div>
{#if controller.runes.search.loading}
  Loading...
{/if}
