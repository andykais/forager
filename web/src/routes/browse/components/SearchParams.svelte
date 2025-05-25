<script lang="ts">
  import type { inputs } from '@forager/core'
  import type { BrowseController } from "../controller.ts";
  import SelectInput from '$lib/components/SelectInput.svelte'
  import * as theme from '$lib/theme.ts'
  import Icon from '$lib/components/Icon.svelte'
  import { Filter, ChevronUp, ChevronDown, ArrowDown, ArrowUp } from '$lib/icons/mod.ts'
  import TagAutoCompleteInput from "$lib/components/TagAutoCompleteInput.svelte";

  let {controller}: {controller: BrowseController} = $props()

  interface State {
    search_string: string
    filepath: string | undefined
    sort: inputs.PaginatedSearch['sort_by']
    unread_only: boolean
    search_mode: 'media' | 'group_by' | 'filesystem'
    group_by: string | undefined
    stars: number | undefined
    order: 'desc' | 'asc'
    media_type: string
  }
  let params = $state<State>({
    search_string: '',
    filepath: undefined as string | undefined,
    sort: 'source_created_at' as const,
    order: 'desc' as const,
    unread_only: false,
    search_mode: 'media',
    group_by: undefined,
    stars: undefined,
    media_type: 'all',
  })

  async function submit() {
    const tags = params.search_string.split(' ').filter(t => t.length > 0)
    const sort_by = params.sort
    const order = params.order
    const filepath = params.filepath
    controller.runes.search.clear()
    const query: inputs.PaginatedSearch['query'] = {
      tags,
      filepath
    }
    switch(params.media_type) {
      case 'all': {
        // do nothing
        break
      }
      case 'animated': {
        query.animated = true
        break
      }
      default: {
        throw new Error(`Unimplemented media type ${params.media_type}`)
      }
    }

    if (params.search_mode === 'media') {
      await controller.runes.search.paginate({
        type: params.search_mode,
        params: {
          query: query,
          sort_by,
          order
        }
      })
    } else if (params.search_mode === 'group_by') {
      await controller.runes.search.paginate({
        type: params.search_mode,
        params: {
          group_by: {
            tag_group: params.group_by,
          },
          query: query,
          sort_by: 'count', // TODO we want to support created_at as well. Sorting is a bit janky with group by for now
          order
        }
      })
    } else {
      throw new Error('unimplemented')
    }
  }

  type AdvancedFiltersState = 'hidden' | 'shown'
  const advanced_filters_default_state = controller.runes.settings.ui.search.advanced_filters.hide ? 'hidden' : 'shown'
  let advanced_filters_state = $state<AdvancedFiltersState>(advanced_filters_default_state)
  const icon_color = theme.colors.gray[800]
  const icon_size = "22px"
</script>

<form class="grid grid-rows-1 w-[80%]"
  onsubmit={async e => {
    e.preventDefault()
    await submit()
  }}>
  <div class="p-3 justify-center items-center">
    <div class="w-full grid grid-cols-[1fr_auto] gap-2 pb-2">
      <TagAutoCompleteInput {controller} bind:search_string={params.search_string} kind="search" allow_multiple_tags />
      <button
        class="hover:cursor-pointer"
        title="click to {advanced_filters_state === 'hidden' ? 'show' : 'hide'} advanced filters"
        type="button"
        onclick={e => {
          if (advanced_filters_state === 'hidden') {
            advanced_filters_state = 'shown'
          } else {
            advanced_filters_state = 'hidden'
          }
        }}>
        <Icon class="fill-gray-800 hover:fill-gray-600" data={Filter} size={icon_size} fill={icon_color} stroke={"none"} />
      </button>
    </div>

    <div class="grid grid-rows-2 justify-center items-center text-slate-950 "
      style="display: {advanced_filters_state === 'hidden' ? 'none' : 'initial'}">
      <div class="grid grid-cols-4 gap-8">
        <div class="flex gap-1">
          <select
            id="sort_by"
            name="sort_by"
            bind:value={params.sort}
            onchange={submit}>
            <option value="source_created_at">Created At</option>
            <option value="created_at">Added On</option>
            <option value="updated_at">Updated At</option>
            <option value="view_count">View Count</option>
          </select>
          <button
            class="hover:cursor-pointer"
            title="order by ascending"
            type="button"
            onclick={e => {
              if (params.order === 'asc') params.order = 'desc'
              else params.order = 'asc'
              submit()
            }}>
            {#if params.order === 'asc'}
              <Icon class="fill-gray-800 hover:fill-gray-600" data={ArrowUp} size={icon_size} fill={icon_color} stroke={"none"} />
            {:else}
              <Icon class="fill-gray-800 hover:fill-gray-600" data={ArrowDown} size={icon_size} fill={icon_color} stroke={"none"} />
            {/if}
          </button>
        </div>

        <SelectInput
          options={[
            {label: 'All', value: 'all'},
            {label: 'Animated', value: 'animated'},
            {label: 'Image',    value: 'image'},
            {label: 'Video',    value: 'video'},
            {label: 'Audio',    value: 'audio'},
          ]}
          bind:value={params.media_type}
          onchange={submit}
        />

        <div class="flex gap-2">
          <label class="" for="unread">Unread:</label>
          <input
            class="rounded-lg"
            name="unread"
            type="checkbox"
            bind:checked={params.unread_only}
            onchange={submit}>
        </div>

        <div class="flex gap-2">
          <label class="" for="filepath">Filepath:</label>
          <input
            class="rounded-lg py-1 px-3 text-slate-100 bg-gray-800 text-sm"
            name="filepath"
            type="text"
            placeholder="*.jpg..."
            bind:value={params.filepath}>
        </div>

      </div>

      <div class="grid grid-cols-2 gap-2">
        <SelectInput
          label="Search Mode"
          options={[
            {label: 'Media', value: 'media'},
            {label: 'Grouped', value: 'group_by'},
            {label: 'Filesystem', value: 'filesystem'},
          ]}
          bind:value={params.search_mode}
        />

        {#if params.search_mode == "group_by"}
          <div class="flex gap-2">
            <label class="" for="group_by">Group By:</label>
            <input
              class="rounded-lg py-1 px-3 text-slate-100 bg-gray-800 text-sm"
              name="group_by"
              type="text"
              bind:value={params.group_by}>
          </div>
        {/if}
      </div>
    </div>
  </div>
  <input type="submit" hidden />
</form>
