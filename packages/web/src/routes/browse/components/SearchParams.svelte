<script lang="ts">
  import SelectInput from '$lib/components/SelectInput.svelte'
  import * as theme from '$lib/theme.ts'
  import Icon from '$lib/components/Icon.svelte'
  import { Filter, ChevronUp, ChevronDown, ArrowDown, ArrowUp } from '$lib/icons/mod.ts'
  import TagAutoCompleteInput from "$lib/components/TagAutoCompleteInput.svelte";
  import type { BrowseController } from "../controller.ts";
  import StarInput from '$lib/components/StarInput.svelte'

  let {controller}: {controller: BrowseController} = $props()

  const {queryparams, media_selections, settings} = controller.runes

  let params = $state<typeof queryparams.DEFAULTS>({...queryparams.DEFAULTS})
  queryparams.popstate_listener(url_params => {
    params = {...url_params}
  })

  async function update_search() {
    await queryparams.submit(params)
    media_selections.clear_current_selection()

  }
  const icon_color = theme.colors.gray[800]
  const icon_size = "22px"
</script>

<form class="grid grid-rows-1 w-screen"
  onsubmit={async e => {
    e.preventDefault()
    await update_search()
  }}>
  <div class="flex flex-col gap-y-2 p-3 justify-center items-center w-screen">
    <div class="w-full grid grid-cols-[1fr_auto] gap-2">
      <TagAutoCompleteInput
        {controller}
        bind:search_string={params.search_string}
        contextual_query={/* TODO re-add queryparams.contextual_query */ null}
        kind="search"
        allow_multiple_tags />
      <button
        class="hover:cursor-pointer"
        title="click to {settings.ui.search.advanced_filters.hide ? 'show' : 'hide'} advanced filters"
        type="button"
        onclick={e => {
          settings.toggle('ui.search.advanced_filters.hide')
        }}>
        <Icon class="fill-gray-800 hover:fill-gray-600" data={Filter} size={icon_size} fill={icon_color} stroke={"none"} />
      </button>
    </div>

    <div class="w-full grid grid-rows-2 justify-space-between items-center text-slate-950 gap-y-2"
      style="display: {settings.ui.search.advanced_filters.hide ? 'none' : 'grid'}">
      <div class="flex flex-row justify-between gap-8">
        <div class="flex gap-1">
          <select
            id="sort_by"
            name="sort_by"
            bind:value={params.sort}
            onchange={update_search}>
            <option value="source_created_at">Created At</option>
            <option value="created_at">Added On</option>
            <option value="updated_at">Updated At</option>
            <option value="view_count">View Count</option>
            <option value="last_viewed_at">Last Viewed</option>
          </select>
          <button
            class="hover:cursor-pointer"
            title="order by ascending"
            type="button"
            onclick={e => {
              if (params.order === 'asc') params.order = 'desc'
              else params.order = 'asc'
              update_search()
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
          onchange={update_search}
        />

        <button
          class={[
            'rounded-lg px-2 border border-2 border-gray-800 hover:border-gray-400',
            params.unread_only
              ? 'bg-gray-800 text-gray-400'
              : ''
          ]}
          onclick={e => params.unread_only = !params.unread_only}
          title="Show unread results only"
        >
          Unread
        </button>

        <div class="flex gap-2 text-gray-400">
          <StarInput bind:value={params.stars} star={1} onclick={update_search} />
          <StarInput bind:value={params.stars} star={2} onclick={update_search} />
          <StarInput bind:value={params.stars} star={3} onclick={update_search} />
          <StarInput bind:value={params.stars} star={4} onclick={update_search} />
          <StarInput bind:value={params.stars} star={5} onclick={update_search} />
          <button
            type="button"
            class="px-2 bg-gray-800 rounded-lg"
            onclick={() => {
              switch(params.stars_equality) {
                /*
                case 'lte': {
                  params.stars_equality = 'eq'
                  break
                }
                */
                case '=': {
                  params.stars_equality = '>='
                  break
                }
                case '>=': {
                  params.stars_equality = '='
                  break
                }
                case undefined: {
                  params.stars_equality = '='
                  break
                }
                default: {
                  throw new Error(`Unexpected params.stars_equality ${params.stars_equality}`)
                }

              }
              update_search()
            }}>
            {params.stars_equality ?? '>='}
          </button>
        </div>

      </div>

      <div class="flex flex-row gap-8 justify-between">
        <div class="flex gap-2">
          <label class="" for="filepath">Filepath:</label>
          <input
            class="rounded-lg py-1 px-3 text-slate-100 bg-gray-800 text-sm"
            name="filepath"
            type="text"
            placeholder="*.jpg..."
            bind:value={params.filepath}>
        </div>

        <SelectInput
          label="Search Mode"
          options={[
            {label: 'Media', value: 'media'},
            {label: 'Grouped', value: 'group_by'},
            {label: 'Filesystem', value: 'filesystem'},
          ]}
          onchange={() => {
            if (params.search_mode !== 'group_by') {
              params.group_by = undefined
            }
          }}
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
