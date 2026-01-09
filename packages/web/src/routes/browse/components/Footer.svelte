<script lang="ts">
  import * as theme from '$lib/theme.ts'
  import type { MediaListPageController } from '$lib/pages/media_list/controller.ts'

  let {controller, height = $bindable()}: {controller: MediaListPageController, height: number} = $props()
  const runes = controller.runes


  function human_readable_number(n: number) {
    const number_string = n.toString()
    const number_groups: string[] = []
    let current_group: string = ''
    for (const digit of Array.from(number_string).reverse()) {
      current_group += digit
      if (current_group.length >= 3) {
        number_groups.push(current_group)
        current_group = ''
      }
    }
    if (current_group) {
      number_groups.push(current_group)
    }
    return Array.from(number_groups.join(',')).reverse().join('')
  }
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
        value={runes.settings.ui.media_list.thumbnail_size}
        oninput={e => {
          runes.settings.set('ui.media_list.thumbnail_size', e.target.value)
        }}>
      <span>{runes.settings.ui.media_list.thumbnail_size}px</span>
    </div>

    <div>
      <button
        title="Toggle thumbnail shape"
        class="rounded-sm bg-gray-800 px-2 text-slate-400 hover:bg-gray-600"
        onclick={e => {
          const updated_shape = runes.settings.ui.media_list.thumbnail_shape === 'square'
            ? 'original'
            : 'square'
          runes.settings.set('ui.media_list.thumbnail_shape', updated_shape)
        }}
      >{runes.settings.ui.media_list.thumbnail_shape}</button>
    </div>

    <span class="">
      Total results {human_readable_number(runes.media_list.total)}
    </span>
  </div>
</footer>
