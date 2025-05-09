<script lang="ts">
  import type { inputs } from '@forager/core'
  import type { BrowseController } from "../controller.ts";
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
    await controller.runes.search.paginate({query: query, sort_by, order})
  }

  type AdvancedFiltersState = 'hidden' | 'shown'
  let advanced_filters_state = $state<AdvancedFiltersState>('hidden')
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

    <div class="flex justify-center items-center gap-8 text-slate-950 "
      style="display: {advanced_filters_state === 'hidden' ? 'none' : 'flex'}">
      <div class="flex gap-2">
        <label class="" for="filepath">Filepath:</label>
        <input
          class="rounded-lg py-1 px-3 text-slate-100 bg-gray-800 text-sm"
          name="filepath"
          type="text"
          placeholder="*.jpg..."
          bind:value={params.filepath}>
      </div>

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

      <div class="flex gap-2">
        <label class="text-nowrap" for="unread">Media Type:</label>
        <select
          bind:value={params.media_type}
          onchange={e => {
            submit()
          }}
        >
          <option value="animated">Animated</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
        </select>
        <input
          class="rounded-lg"
          name="unread"
          type="checkbox"
          placeholder="dir/*.jpg"
          bind:checked={params.unread_only}
          onchange={submit}>
      </div>

      <div class="flex gap-2">
        <label class="" for="unread">Unread:</label>
        <input
          class="rounded-lg"
          name="unread"
          type="checkbox"
          placeholder="dir/*.jpg"
          bind:checked={params.unread_only}
          onchange={submit}>
      </div>
    </div>
  </div>
  <input type="submit" hidden />
</form>
