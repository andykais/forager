<script lang="ts">
  import { tick } from 'svelte'
  import * as path from '@std/path'
  import type { BrowseController } from '../controller.ts'
  import type { MediaViewRune, Input } from '$lib/runes/index.ts'
  import { MediaListRune } from '$lib/runes/index.ts'
  import { focusable, scrollable, visible } from '$lib/actions/mod.ts'
  import Icon from '$lib/components/Icon.svelte'
  import SearchLink from './SearchLink.svelte'
  import * as icons from '$lib/icons/mod.ts'
  import * as theme from '$lib/theme.ts'

  interface Props {
    controller: BrowseController
    result: MediaViewRune
    result_index: number
  }

  let {controller, result, result_index}: Props = $props()
  const {settings, media_selections, queryparams} = controller.runes

  const GAP = 4
  const MIN_PAGE_LIMIT = 30
  const icon_size = 14
  const icon_color = theme.colors.green[200]

  type FilmstripKind =
    | 'single'    // a single thumbnail (images & audio)
    | 'video'     // a fixed set of thumbnails sampled across the video's duration
    | 'paginated' // series items or group entries, loaded page by page as the strip scrolls

  const kind: FilmstripKind = $derived.by(() => {
    if (result.media_type === 'media_file') {
      return result.media_file.media_type === 'VIDEO' ? 'video' : 'single'
    }
    if (result.media_type === 'media_series' || result.media_type === 'grouped') {
      return 'paginated'
    }
    throw new Error(`Unexpected media type '${result.media_type}' for filmstrip`)
  })

  let strip_element: HTMLDivElement | undefined = $state()
  let viewport_width = $state(0)
  let scroll_state = $state({left: 0, width: 0, client: 0})
  let entries_list: MediaListRune | undefined = $state()
  // tracks where an in-flight smooth scroll is headed so repeated key presses accumulate
  let target_left: number | undefined

  const cell_size = $derived(settings.ui.media_list.thumbnail_size)
  const step = $derived(cell_size + GAP)
  const rows = $derived(kind === 'single' ? 1 : settings.ui.media_list.filmstrip.rows)
  const visible_columns = $derived(Math.max(1, Math.floor((viewport_width + GAP) / step)))
  const strip_height = $derived(rows * cell_size + (rows - 1) * GAP)
  const page_limit = $derived(Math.max(MIN_PAGE_LIMIT, visible_columns * rows * 2))
  const is_selected = $derived(media_selections.current_selection.result_index === result_index)
  const img_classes = $derived(settings.ui.media_list.thumbnail_shape === 'square' ? 'object-cover' : 'object-contain')

  const video_thumbnails = $derived.by(() => {
    if (kind !== 'video') return []
    const all_thumbnails = result.state.full_thumbnails?.results ?? result.thumbnails.results
    const count = visible_columns * rows
    if (all_thumbnails.length <= count) return all_thumbnails
    return Array.from({length: count}, (_, index) => all_thumbnails[Math.floor(index * all_thumbnails.length / count)])
  })

  const can_scroll_left = $derived(scroll_state.left > 1)
  const at_end = $derived(scroll_state.left + scroll_state.client >= scroll_state.width - 1)
  const can_scroll_right = $derived(!at_end || (kind === 'paginated' && (entries_list?.has_more ?? false)))

  function entries_input(): Input {
    if (result.media_type === 'media_series') {
      return {type: 'series', params: {query: {series_id: result.media_reference.id}, limit: page_limit}}
    } else if (result.media_type === 'grouped') {
      return {type: 'media', params: {...result.entries_search_params, limit: page_limit}}
    }
    throw new Error(`Unexpected media type '${result.media_type}' for a paginated filmstrip`)
  }

  function load() {
    if (kind === 'video') {
      result.load_detailed_view()
    } else if (kind === 'paginated' && entries_list === undefined) {
      entries_list = new MediaListRune(controller.client)
      entries_list.paginate(entries_input())
    }
  }

  function maybe_paginate() {
    if (!strip_element || !entries_list) return
    if (!entries_list.has_more || entries_list.loading) return
    // keep roughly a page of unseen entries loaded past the right edge
    if (strip_element.scrollLeft + strip_element.clientWidth * 2 >= strip_element.scrollWidth) {
      entries_list.paginate()
    }
  }

  function measure() {
    if (!strip_element) return
    scroll_state = {
      left: strip_element.scrollLeft,
      width: strip_element.scrollWidth,
      client: strip_element.clientWidth,
    }
    maybe_paginate()
  }

  $effect(() => {
    // re-measure whenever the content or the viewport changes size
    void entries_list?.results.length
    void viewport_width
    void rows
    void cell_size
    tick().then(measure)
  })

  function scroll_to(left: number) {
    if (!strip_element) return
    const max_left = Math.max(0, strip_element.scrollWidth - strip_element.clientWidth)
    const clamped = Math.min(Math.max(0, left), max_left)
    target_left = clamped
    strip_element.scrollTo({left: clamped, behavior: 'smooth'})
  }

  async function scroll_columns(columns: number) {
    if (!strip_element) return
    const current_left = target_left ?? strip_element.scrollLeft
    const target = Math.round(current_left / step) * step + columns * step
    if (columns > 0 && entries_list?.has_more && target + strip_element.clientWidth >= strip_element.scrollWidth) {
      await entries_list.paginate()
      await tick()
    }
    scroll_to(target)
  }

  const scroll_item = (direction: 1 | -1) => scroll_columns(direction)
  const scroll_page = (direction: 1 | -1) => scroll_columns(direction * visible_columns)
  const scroll_start = () => scroll_to(0)
  const scroll_end = () => {
    if (!strip_element) return
    scroll_to(strip_element.scrollWidth)
  }

  function is_active() {
    return !media_selections.current_selection.show
      && strip_element !== undefined
      && strip_element.contains(document.activeElement)
  }

  function filmstrip_handler(action: () => void) {
    return (e: CustomEvent<{data: {keyboard_event: KeyboardEvent}}>) => {
      if (!is_active()) return
      e.detail.data.keyboard_event.preventDefault()
      action()
    }
  }

  controller.keybinds.component_listen({
    FilmstripNextItem: filmstrip_handler(() => scroll_item(1)),
    FilmstripPrevItem: filmstrip_handler(() => scroll_item(-1)),
    FilmstripNextPage: filmstrip_handler(() => scroll_page(1)),
    FilmstripPrevPage: filmstrip_handler(() => scroll_page(-1)),
    FilmstripEnd: filmstrip_handler(scroll_end),
    FilmstripStart: filmstrip_handler(scroll_start),
  })

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

  function format_timestamp(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const remainder = Math.floor(seconds % 60).toString().padStart(2, '0')
    return `${minutes}:${remainder}`
  }

  const thumbnail_classes = "w-full h-full rounded-md shadow shadow-gray-900 hover:outline-2 hover:outline-slate-400"
</script>

<div
  class="px-4 py-2"
  data-filmstrip-index={result_index}
  use:scrollable={is_selected}
  use:visible={load}
>
  <div class="flex items-center gap-1 text-xs text-gray-400 pb-1 pl-7">
    {#if result.media_type === 'media_file'}
      {#if result.media_file.media_type === 'VIDEO'}
        <Icon data={icons.PlayCircle} fill={icon_color} stroke="none" size={icon_size} />
        {#if result.media_file.audio}
          <Icon data={icons.Music} fill={icon_color} stroke="none" size={icon_size} />
        {/if}
      {:else if result.media_file.media_type === 'IMAGE' && result.media_file.content_type === 'image/gif'}
        <Icon data={icons.Gif} fill={icon_color} stroke="none" size={icon_size} />
      {:else if result.media_file.media_type === 'IMAGE'}
        <Icon data={icons.Photo} fill={icon_color} stroke="none" size={icon_size} />
      {:else if result.media_file.media_type === 'AUDIO'}
        <Icon data={icons.Music} fill={icon_color} stroke="none" size={icon_size} />
      {/if}
      <span class="truncate">{result.media_reference.title ?? path.basename(result.media_file.filepath)}</span>
      {#if result.media_file.media_type === 'VIDEO'}
        <span>{human_readable_duration(result.media_file.duration)}</span>
      {/if}
    {:else if result.media_type === 'media_series'}
      <Icon data={icons.Copy} fill={icon_color} stroke="none" size={icon_size} />
      <span class="truncate">{result.media_reference.media_series_name ?? result.media_reference.title ?? 'Series'}</span>
      <span>({result.media_reference.media_series_length})</span>
    {:else if result.media_type === 'grouped'}
      <Icon data={icons.Copy} fill={icon_color} stroke="none" size={icon_size} />
      <SearchLink
        class="hover:text-green-500 hover:bg-gray-700 px-1 rounded-sm"
        {controller}
        params={queryparams.merge({mode: 'media', tags: `${queryparams.current.group_by ?? ''}:${result.group_metadata.value}`})}
      >{result.group_metadata.value}</SearchLink>
      <span>({result.group_metadata.count})</span>
    {/if}
  </div>

  <div class="grid grid-cols-[auto_1fr_auto] gap-1 items-center">
    <button
      type="button"
      title="Previous page"
      class="w-6 flex items-center justify-center rounded-sm bg-gray-800 hover:bg-gray-600 disabled:opacity-25 disabled:hover:bg-gray-800 disabled:cursor-default"
      style="height: {strip_height}px"
      disabled={!can_scroll_left}
      onclick={() => scroll_page(-1)}
    >
      <Icon data={icons.ChevronLeft} fill={icon_color} stroke="none" size={16} />
    </button>

    <div
      bind:this={strip_element}
      bind:clientWidth={viewport_width}
      class={[
        "filmstrip overflow-x-auto overflow-y-hidden rounded-md outline-none border-2",
        is_selected ? "border-green-300" : "border-transparent",
      ]}
      role="listbox"
      aria-label="Filmstrip"
      tabindex="0"
      use:focusable={!media_selections.current_selection.show && is_selected}
      onfocusin={() => media_selections.select_media(result, result_index)}
      onscroll={measure}
      onscrollend={() => {
        target_left = undefined
        measure()
      }}
    >
      {#if kind === 'single'}
        <div class="grid" style="grid-template-columns: {cell_size}px; height: {strip_height}px;">
          <button
            type="button"
            tabindex="-1"
            title="Open"
            onclick={() => media_selections.open_entry(result, result_index)}
          >
            <img class="{thumbnail_classes} {img_classes}" src={result.preview_thumbnail} alt="Thumbnail for {result.media_reference.title ?? 'media'}" />
          </button>
        </div>
      {:else if kind === 'video'}
        <div
          class="grid"
          style="grid-template-columns: repeat({visible_columns}, {cell_size}px); grid-auto-rows: {cell_size}px; gap: {GAP}px; height: {strip_height}px;"
        >
          {#each video_thumbnails as thumbnail (thumbnail.id)}
            <button
              type="button"
              tabindex="-1"
              class="relative"
              title="Play from {format_timestamp(thumbnail.media_timestamp)}"
              onclick={() => media_selections.open_entry(result, result_index, {seek_to: thumbnail.media_timestamp})}
            >
              <img class="{thumbnail_classes} {img_classes}" src="/files/thumbnail/{thumbnail.id}" alt="Thumbnail at {format_timestamp(thumbnail.media_timestamp)}" />
              <span class="absolute bottom-1 right-1 text-[10px] leading-none px-1 py-0.5 rounded-sm bg-gray-900/70 text-gray-200">
                {format_timestamp(thumbnail.media_timestamp)}
              </span>
            </button>
          {/each}
        </div>
      {:else}
        <div
          class="grid grid-flow-col"
          style="grid-template-rows: repeat({rows}, {cell_size}px); grid-auto-columns: {cell_size}px; gap: {GAP}px; height: {strip_height}px;"
        >
          {#each entries_list?.results ?? [] as entry, entry_index (entry.media_reference.id)}
            <button
              type="button"
              tabindex="-1"
              title={entry.media_reference.title ?? `Entry ${entry_index + 1}`}
              onclick={() => media_selections.open_entry(entry, result_index)}
            >
              <img class="{thumbnail_classes} {img_classes}" src={entry.preview_thumbnail} alt="Thumbnail for {entry.media_reference.title ?? 'media'}" />
            </button>
          {/each}
          {#if entries_list === undefined || entries_list.loading}
            <div class="flex items-center justify-center text-xs text-gray-500" style="grid-row: 1 / span {rows}">Loading...</div>
          {/if}
        </div>
      {/if}
    </div>

    <button
      type="button"
      title="Next page"
      class="w-6 flex items-center justify-center rounded-sm bg-gray-800 hover:bg-gray-600 disabled:opacity-25 disabled:hover:bg-gray-800 disabled:cursor-default"
      style="height: {strip_height}px"
      disabled={!can_scroll_right}
      onclick={() => scroll_page(1)}
    >
      <Icon data={icons.ChevronRight} fill={icon_color} stroke="none" size={16} />
    </button>
  </div>
</div>

<style>
  .filmstrip {
    scrollbar-width: thin;
    scrollbar-color: var(--color-gray-600) transparent;
  }
</style>
