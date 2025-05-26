<script lang="ts">
  import * as theme from '$lib/theme.ts'
  import type { BrowseController } from '../controller.ts'

  let {controller, height = $bindable()}: {controller: BrowseController, height: number} = $props()
  const runes = controller.runes
</script>

<style>
  .slider-handle::-webkit-slider-thumb {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: var(--slider-thumb-color);
  }
  .slider-handle::-moz-range-thumb {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: var(--slider-thumb-color);
  }
  .slider-handle::-moz-range-thumb:hover {
    background: var(--slider-thumb-color-hover);
  }
</style>

<footer
  class="
  bg-gray-700 items-center px-2 py-1
  text-slate-900 border-t border-t-[2px] border-gray-800"
  bind:clientHeight={height}
>

  <div class="grid grid-cols-[1fr_auto_auto] gap-4 justify-between">
    <div class="w-full grid grid-cols-[auto_1fr_auto] gap-4 items-center" style="--slider-thumb-color: {theme.colors.green[300]}; --slider-thumb-color-hover: {theme.colors.green[500]}">
      <label for="thumbnail-size">Thumbnail Size</label>
      <input
        class="appearance-none h-[7px] rounded-full bg-gray-800 slider-handle"
        name="thumbnail-size"
        type="range"
        min={50}
        max={500}
        bind:value={runes.settings.ui.media_list.thumbnail_size}>
      <span>{runes.settings.ui.media_list.thumbnail_size}px</span>
    </div>

    <div>
      <button
        title="Toggle thumbnail shape"
        class="rounded-sm bg-gray-800 px-2 text-slate-400 hover:bg-gray-600 transition-colors"
        onclick={e => {
          if (runes.settings.ui.media_list.thumbnail_shape === 'square') {
            runes.settings.ui.media_list.thumbnail_shape = 'original'
          } else {
            runes.settings.ui.media_list.thumbnail_shape = 'square'
          }
        }}
      >{runes.settings.ui.media_list.thumbnail_shape}</button>
    </div>

    <span class="">
      Total results {controller.runes.search.total}
    </span>
  </div>
</footer>
