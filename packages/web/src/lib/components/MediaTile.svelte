<script lang="ts">
  import type { MediaBrowserController } from '$lib/components/MediaBrowserLayout.svelte'
  import * as theme from '$lib/theme.ts'
  import { focusable, scrollable } from '$lib/actions/mod.ts'
  import Icon from '$lib/components/Icon.svelte'
  import * as icons from '$lib/icons/mod.ts'
  import type { Snippet } from 'svelte'
  import type { MediaViewRune } from '$lib/runes/media_view_rune.svelte.ts'

  interface Props {
    controller: MediaBrowserController
    result: MediaViewRune
    result_index: number
    metadata?: Snippet<[{ result: MediaViewRune }]>
  }

  let { controller, result, result_index, metadata }: Props = $props()
  const { settings, media_selections } = controller.runes

  const icon_size = 14
  const icon_color = theme.colors.green[200]

  function human_readable_duration(seconds: number) {
    if (seconds < 100) {
      return `${seconds.toFixed(1)}s`
    }
    const minutes = seconds / 60
    if (minutes < 60) {
      return `${minutes.toFixed(1)}m`
    }
    const hours = minutes / 60
    return `${hours.toFixed(2)}h`
  }
</script>

<div>
  <div
    type="button"
    class="inline-flex items-center justify-center p-1
           outline-none"
    use:scrollable={media_selections.current_selection.result_index === result_index}
  >
    <div
      class="grid gap-[5px] grid-rows-[1fr_max-content] h-full w-full items-center"
      style="width:{settings.ui.media_list.thumbnail_size}px"
    >
      <div
        class="flex justify-center items-center overflow-hidden focus:outline-none"
        style="width:{settings.ui.media_list.thumbnail_size}px; height: {settings.ui.media_list.thumbnail_size}px"
        onkeydown={e => {
          if (e.key === 'Enter') {
            media_selections.set_current_selection(result, result_index)
          }
        }}
        role="button"
        tabindex="0"
        use:focusable={!media_selections.current_selection.show && media_selections.current_selection.result_index === result_index}
        onclick={e => media_selections.set_current_selection(result, result_index)}
      >
        {#if settings.ui.media_list.thumbnail_shape === 'original'}
          <img
            class={[
              "shadow shadow-gray-700 rounded-md hover:shadow-slate-400 hover:border-slate-400 hover:border hover:border-2",
              result.img_fit_classes(),
              result_index !== media_selections.current_selection.result_index
                && "shadow-slate-900 shadow-green-300",
              result_index === media_selections.current_selection.result_index
                && "hover:border-slate-400 border-green-300 border border-2 hover:shadow-slate-400 shadow-green-300",
            ]}
            src={result.preview_thumbnail}
            alt="Thumbnail for media reference {result.media_reference?.id}"/>
        {:else}
          <img
            class={[
              "w-full h-full object-cover shadow shadow-gray-700 rounded-md hover:shadow-slate-400 hover:border-slate-400 hover:border hover:border-2",
              result.img_fit_classes(),
              result_index !== media_selections.current_selection.result_index
                && "hover:shadow-slate-400 shadow-slate-900 shadow-green-300",
              result_index === media_selections.current_selection.result_index
                && "hover:border-slate-400 border-green-300 border border-2 hover:shadow-slate-400 shadow-green-300",
            ]}
            src={result.preview_thumbnail}
            alt="Thumbnail for media reference {result.media_reference?.id}"/>
        {/if}
      </div>

      <!-- info chips -->
      <div class="flex text-xs text-gray-400 justify-between p-0.5">
        {#if result.media_type === 'media_file'}
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
          <span>{result.group_metadata.count}</span>
        {:else}
          UNEXPECTED MEDIA TYPE {result.media_type}
        {/if}
      </div>

      <!-- custom metadata slot -->
      {#if metadata}
        {@render metadata({ result })}
      {/if}
    </div>
  </div>
</div>
