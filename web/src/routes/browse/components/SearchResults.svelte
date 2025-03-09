<script lang="ts">
  import type { BrowseController } from '../controller.ts'
  import type { Forager } from '@forager/core'
  import * as theme from '$lib/theme.ts'
  import { create_selector } from '../runes/media_selections.svelte.ts'
  import MediaView from './MediaView.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { PlayCircle, Photo } from '$lib/icons/mod.ts'

  interface Props {
    controller: BrowseController
  }

  let {controller }: Props = $props()

  let tile_size = 100
  const media_selections = controller.runes.media_selections
  let dialog: HTMLDialogElement

</script>

<style>
  .container-masonry {
    display: grid;
    grid-gap: 10px;
    grid-column-gap: 15px;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));

    position: relative;
  }

  .container-media-tile {
    display: grid;
    gap: 2px;
    grid-template-rows: 1fr max-content;
    height: 100%;
    width: 100%;
    align-items: center;
  }
</style>



<MediaView {controller} />
<form
  class="container-masonry p-4"
  onsubmit={media_selections.open_media}
>
  {#each controller.runes.search.results as result}
    {#if result.media_type === 'media_file'}
      <div>
      <button class="
        p-1
        inline-flex items-center justify-center
        shadow shadow-slate-700 bg-slate-500
        border-2
        rounded-md"
        class:hover:hover:border-slate-200={result.media_reference.id !== media_selections.current_selection.media_response?.media_reference_id}
        class:border-slate-500={result.media_reference.id !== media_selections.current_selection.media_response?.media_reference_id}
        class:border-green-300={result.media_reference.id === media_selections.current_selection.media_response?.media_reference_id}
        onclick={e => media_selections.set_current_selection(e, result)}
      >
        <div class="container-media-tile" style="width:{tile_size}px">
          <div
            class="grid justify-items-center items-center"
            style="width:{tile_size}px; height: {tile_size}px">
            <img
              class="max-w-full max-h-full"
              src="/files/thumbnail{result.thumbnails.results[0].filepath}"
              alt="Failed to load /files/thumbnail{result.thumbnails.results[0].filepath}"/>
          </div>

          <!-- info chips -->
          <div>
            {#if result.media_file.media_type === 'VIDEO'}
              <Icon data={PlayCircle} fill={theme.colors.green[200]} stroke="none" />
            {:else if result.media_file.media_type === 'IMAGE'}
              <Icon data={Photo} fill={theme.colors.green[200]} stroke="none" />
            {:else}
              unknown
            {/if}
          </div>
        </div>
      </button>
      </div>
    {:else}
      <div>unimplemented</div>
    {/if}
  {/each}
</form>
{#if controller.runes.search.loading}
  Loading...
{/if}
