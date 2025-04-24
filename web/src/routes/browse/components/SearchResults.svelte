<script lang="ts">
  import type { BrowseController } from '../controller.ts'
  import type { Forager } from '@forager/core'
  import * as theme from '$lib/theme.ts'
  import { focusable } from '$lib/actions/mod.ts'
  import Icon from '$lib/components/Icon.svelte'
  import * as icons from '$lib/icons/mod.ts'

  interface Props {
    controller: BrowseController
  }

  let props: Props = $props()
  const {runes} = props.controller

  let tile_size = runes.settings.ui.media_list.thumbnail_size
  const icon_size = 14
  const icon_color = theme.colors.green[200]
  const media_selections = runes.media_selections
  let dialog: HTMLDialogElement

</script>

<style>
  .container-masonry {
    display: grid;
    grid-gap: 10px;
    grid-column-gap: 15px;
    grid-template-columns: repeat(auto-fill, minmax(var(--thumbnail-size), 1fr));
    justify-items: center;
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



<div class="container-masonry p-4" style="--thumbnail-size: {runes.settings.ui.media_list.thumbnail_size}px">
  {#each runes.search.results as result, result_index}
    <div>
      <button 
        type="button"
        class="inline-flex items-center justify-center p-1
               outline-none"
        use:focusable={!media_selections.current_selection.show && media_selections.current_selection.result_index === result_index}
        onclick={e => media_selections.set_current_selection(result, result_index)}>
        <div class="container-media-tile" style="width:{runes.settings.ui.media_list.thumbnail_size}px">
          <div
            class="grid justify-items-center items-center overflow-hidden
                   border-2 shadow shadow-gray-700 rounded-md"
            class:hover:border-slate-400={result.media_reference.id !== media_selections.current_selection.media_response?.media_reference.id}
            class:border-slate-900={result.media_reference.id !== media_selections.current_selection.media_response?.media_reference.id}
            class:border-green-300={result.media_reference.id === media_selections.current_selection.media_response?.media_reference.id}
            style="width:{runes.settings.ui.media_list.thumbnail_size}px; height: {runes.settings.ui.media_list.thumbnail_size}px">
            <img
              class="w-full h-full object-cover"
              src="/files/thumbnail{result.preview_thumbnail.filepath}"
              alt="Failed to load /files/thumbnail{result.preview_thumbnail.filepath}"/>
          </div>

          <!-- info chips -->
          <div class="flex text-xs text-gray-400 justify-between  p-0.5">
            {#if result.media_type === 'media_file'}
              {#if result.media_file.media_type === 'VIDEO'}
                <Icon data={icons.PlayCircle} fill={icon_color} stroke="none" size={icon_size} />
              {:else if result.media_file.media_type === 'IMAGE' && result.media_file.content_type === 'image/gif'}
                <Icon data={icons.Gif} fill={icon_color} stroke="none" size={icon_size} />
              {:else if result.media_file.media_type === 'IMAGE'}
                <Icon data={icons.Photo} fill={icon_color} stroke="none" size={icon_size} />
              {:else if result.media_file.media_type === 'AUDIO'}
                <Icon data={icons.Music} fill={icon_color} stroke="none" size={icon_size} />
              {:else}
                unknown media type {result.media_file.media_type}
              {/if}
          {:else if result.media_type === 'media_series'}
              <Icon data={icons.Copy} fill={icon_color} stroke="none" size={icon_size} />
              {result.media_reference.media_series_length} items
          {:else}
            UNEXPECTED MEDIA TYPE {result.media_type}
          {/if}
        </div>
      </button>
    </div>
  {/each}
</div>
{#if runes.search.loading}
  Loading...
{/if}
