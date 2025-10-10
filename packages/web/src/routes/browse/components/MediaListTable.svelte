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

  // TODO this whole thing needs to be bifurcated when we do group_by or filesystem listing
  type Column =
    | 'id'
    | 'thumbnail'
    | 'title'
    | 'description'
    | 'stars'
    | 'added_on'
    | 'source_created_at'
    | 'updated_at'
    | 'view_count'
    | 'file_size'
    | 'file_type'
  interface ColumnDefintion {
    slug: Column
    label: string
    sortable?: boolean
  }
  const COLUMNS: ColumnDefintion[]  = [
    {
      slug: 'id',
      label: 'Id',
    },
    {
      slug: 'thumbnail',
      label: 'Thumbnail',
    },
    {
      slug: 'title',
      label: 'Title',
    },
    {
      slug: 'description',
      label: 'Description',
    },
    {
      slug: 'stars',
      label: 'Stars',
    },
    {
      slug: 'view_count',
      label: 'Views',
    },
  ]

  let columns = $state(COLUMNS)
</script>


<div>
  <table>
    <thead>
      <tr>
        {#each columns as column}
          <td>{column.label}</td>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each media_list.results as result, result_index}
          <tr>
            {#each columns as column}
              {#if column.slug === 'id'}
                <td>{result.media_reference.id}</td>
              {/if}
              {#if column.slug === 'thumbnail'}
                <td
                  style="width:{settings.ui.media_list.thumbnail_size}px; height: {settings.ui.media_list.thumbnail_size}px"
                >
                  <img
                    class={[
                      result.img_fit_classes(),
                      (settings.ui.media_list.thumbnail_shape === 'square') && "object-cover w-full h-full"
                    ]}
                    src="/files/thumbnail{result.preview_thumbnail.filepath}"
                    alt="/files/thumbnail{result.preview_thumbnail.filepath}"/>
                </td>
              {/if}
              {#if column.slug === 'title'}
                <td>{result.media_reference.title}</td>
              {/if}
              {#if column.slug === 'description'}
                <td>{result.media_reference.description}</td>
              {/if}
              {#if column.slug === 'stars'}
                <td>{result.media_reference.stars}</td>
              {/if}
              {#if column.slug === 'view_count'}
                <td>{result.media_reference.view_count}</td>
              {/if}
            {/each}
          </tr>
      {/each}
    </tbody>
  </table>
</div>
