<script lang="ts">
  import type { BrowseController } from '../controller.ts'
  import * as theme from '$lib/theme.ts'
  import { focusable, scrollable } from '$lib/actions/mod.ts'
  import Icon from '$lib/components/Icon.svelte'
  import SearchLink from './SearchLink.svelte'
  import * as datetime from '@std/datetime'
  import Datetime from '$lib/components/Datetime.svelte'
  import * as icons from '$lib/icons/mod.ts'
  import MediaTileInfoTable from './MediaTileInfoTable.svelte';

  interface Props {
    controller: BrowseController
  }

  let {controller}: Props = $props()
  const {queryparams, settings, media_selections, media_list} = controller.runes

  let tile_size = settings.ui.media_list.thumbnail_size
  const icon_size = 14
  const icon_color = theme.colors.green[200]
  let dialog: HTMLDialogElement

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

  function format_human_readable_datetime(date_str: string) {
    const date = new Date(date_str)
    console.log({date})
    return datetime.format(date, 'yyyy/MM/dd')
  }
  interface SearchResultGroupMetadata {}
  function human_readable_sort_per_group(group_metadata: SearchResultGroupMetadata) {
    const order = controller.runes.queryparams.current.order === 'desc' ? 'oldest' : 'newest'
    let sort_descriptor: string
    let human_readable_datetime: string
    switch (controller.runes.queryparams.current.sort) {
      case 'source_created_at': {
        sort_descriptor = 'created'
        human_readable_datetime = format_human_readable_datetime(group_metadata.source_created_at)
        break
      }
      case 'created_at': {
        sort_descriptor = 'added on'
        human_readable_datetime = format_human_readable_datetime(group_metadata.created_at)
        break
      }
      case 'updated_at': {
        sort_descriptor = 'updated'
        human_readable_datetime = format_human_readable_datetime(group_metadata.updated_at)
        break
      }
      defaut: {
        throw new Error(`Unexpected query params sort ${controller.runes.queryparams.current.sort}`)
      }
    }

    // Newest added on {result.group_metadata.created_at}
    console.log({datetime})

    // sort descriptor does not seem particularly nice. E.g. "oldest created YYYY/MM/dd"
    // we already have this information at the top with "created_at". We could even abstract away "oldest" as a icon.
    // return `${order} ${sort_descriptor} ${human_readable_datetime}`
    // return `${order} ${human_readable_datetime}`
    return human_readable_datetime
  }
</script>

<style>
  .container-masonry {
    display: grid;
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
  {#each media_list.results as result, result_index}
    <div>
      <div 
        type="button"
        class="inline-flex items-center justify-center p-1
               outline-none"
        use:scrollable={media_selections.current_selection.result_index === result_index}
      >
        <div
          class="container-media-tile"
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
                alt="Thumbnail for {result.media_reference?.title ?? 'media'}"/>
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
                alt="Thumbnail for {result.media_reference?.title ?? 'media'}"/>
            {/if}
          </div>

          <!-- info chips -->
          <div class="flex text-xs text-gray-400 justify-between  p-0.5">
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
              <MediaTileInfoTable
                {controller}
                entries={[
                  { name: 'tag_group',
                    icon: icons.Copy,
                    value:result.group_metadata.value,
                    stat: result.group_metadata.count,
                    queryparams: queryparams.merge({mode: 'media', tags: `${queryparams.current.group_by ?? ''}:${result.group_metadata.value}`}),
                    enabled: controller.runes.settings.ui.media_list.info_tiles.tag_group.enabled,
                    order: controller.runes.settings.ui.media_list.info_tiles.tag_group.order,
                  },
                  {
                    name: 'sort_top',
                    icon: icons.ArrowUp,
                    value: human_readable_sort_per_group(result.group_metadata),
                    enabled: controller.runes.settings.ui.media_list.info_tiles.sort_top.enabled,
                    order: controller.runes.settings.ui.media_list.info_tiles.sort_top.order,
                  },
                ]}
              />
          {:else}
            UNEXPECTED MEDIA TYPE {result.media_type}
          {/if}
        </div>
        </div>
      </div>
    </div>
  {/each}
</div>
{#if media_list.loading}
  Loading...
{/if}
