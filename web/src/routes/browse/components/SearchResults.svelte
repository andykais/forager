<script lang="ts">
  import type { Forager } from '@forager/core'
  import * as theme from '$lib/theme.ts'
  import Icon from '$lib/components/Icon.svelte'
  import { PlayCircle, Photo } from '$lib/icons/mod.ts'

  interface Props {
    results: Awaited<ReturnType<Forager['media']['search']>['results']>
  }
  let {results}: Props = $props()

  let width = 100
  let height = 100
</script>

<style>
  .container-masonry {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    grid-template-rows: masonry;
    masonry-auto-flow: next ;
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



<div class="container-masonry p-4">
  {#each results as result}
    {#if result.media_type === 'media_file'}
      <button class="
        p-1
        inline-flex items-center justify-center
        shadow shadow-slate-700 bg-slate-500
        border-2 border-slate-500
        hover:border-slate-200 hover:border-2
        rounded-md">
        <div class="container-media-tile" style="width:{width}px">
          <div
            class="grid justify-items-center items-center"
            style="width:{width}px; height: {height}px">
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
    {:else}
      <div>unimplemented</div>
    {/if}
  {/each}
</div>
