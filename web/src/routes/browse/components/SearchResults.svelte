<script lang="ts">
  import type { BrowseController } from '../controller.ts'
  import * as theme from '$lib/theme.ts'
  import { focusable } from '$lib/actions/mod.ts'
  import Icon from '$lib/components/Icon.svelte'
  import SearchLink from './SearchLink.svelte'
  import * as icons from '$lib/icons/mod.ts'

  interface Props {
    controller: BrowseController
  }

  let {controller}: Props = $props()
  const {queryparams, settings, media_selections, search} = controller.runes

  let tile_size = settings.ui.media_list.thumbnail_size
  const icon_size = 14
  const icon_color = theme.colors.green[200]
  let dialog: HTMLDialogElement

  function human_readable_duration(seconds: number) {
    if (seconds < 100) {
      return `${seconds}s`
    }
    const minutes = seconds / 60
    if (minutes < 60) {
      return `${minutes.toFixed(2)}m`
    }
    const hours = minutes / 60
    return `${hours.toFixed(2)}h`
  }
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



<div class="container-masonry p-4" style="--thumbnail-size: {settings.ui.media_list.thumbnail_size}px">
  {#each search.results as result, result_index}
    <div>
      <button 
        type="button"
        class="inline-flex items-center justify-center p-1
               outline-none"
        use:focusable={!media_selections.current_selection.show && media_selections.current_selection.result_index === result_index}
      >
        <div
          class="container-media-tile"
          style="width:{settings.ui.media_list.thumbnail_size}px"
        >
          <div
            class="grid justify-items-center items-center overflow-hidden
                   "
            style="width:{settings.ui.media_list.thumbnail_size}px; height: {settings.ui.media_list.thumbnail_size}px"
            onclick={e => media_selections.set_current_selection(result, result_index)}
          >
            {#if settings.ui.media_list.thumbnail_shape === 'original'}
              <img
                class={[
                  "border-2 shadow shadow-gray-700 rounded-md",
                  result.img_fit_classes()
                ]}
                class:hover:border-slate-400={result_index !== media_selections.current_selection.result_index}
                class:border-slate-900={      result_index !== media_selections.current_selection.result_index}
                class:border-green-300={      result_index === media_selections.current_selection.result_index}
                src="/files/thumbnail{result.preview_thumbnail.filepath}"
                alt="/files/thumbnail{result.preview_thumbnail.filepath}"/>
            {:else}
              <img
                class="
                  w-full h-full object-cover
                  border-2 shadow shadow-gray-700 rounded-md"
                class:hover:border-slate-400={result_index !== media_selections.current_selection.result_index}
                class:border-slate-900={      result_index !== media_selections.current_selection.result_index}
                class:border-green-300={      result_index === media_selections.current_selection.result_index}
                src="/files/thumbnail{result.preview_thumbnail.filepath}"
                alt="/files/thumbnail{result.preview_thumbnail.filepath}"/>
            {/if}
          </div>

          <!-- info chips -->
          <div class="flex text-xs text-gray-400 justify-between  p-0.5">
            {#if result.media_type === 'media_file'}
              <span>id: {result.media_reference.id}</span>
              {#if result.media_file.media_type === 'VIDEO'}
                <span class="flex">
                  <Icon data={icons.PlayCircle} fill={icon_color} stroke="none" size={icon_size} />
                  {#if result.media_file.audio}
                    <Icon data={icons.Music} fill={icon_color} stroke="none" size={icon_size} />
                  {/if}
                </span>
                <span>{human_readable_duration(result.media_file.duration)}</span>
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
              <span>({result.media_reference.media_series_length})</span>
          {:else if result.media_type === 'grouped'}
              <Icon data={icons.Copy} fill={icon_color} stroke="none" size={icon_size} />
              <SearchLink
                class="hover:text-green-500 hover:bg-gray-700 px-2 rounded-sm transition-colors"
                {controller} params={queryparams.merge({mode: 'media', tags: `${queryparams.current_url.group_by}:${result.group_metadata.value}`})}> {result.group_metadata.value} 
              </SearchLink>
              <span>{result.group_metadata.count}</span>
          {:else}
            UNEXPECTED MEDIA TYPE {result.media_type}
          {/if}
        </div>
      </button>
    </div>
  {/each}
</div>
{#if search.loading}
  Loading...
{/if}
