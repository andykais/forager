<script lang="ts">
  import SelectInput from '$lib/components/SelectInput.svelte'
  import * as theme from '$lib/theme.ts'
  import Icon from '$lib/components/Icon.svelte'
  import { Filter, ArrowDown, ArrowUp } from '$lib/icons/mod.ts'
  import TagAutoCompleteInput from '$lib/components/TagAutoCompleteInput.svelte'
  import type { BrowseLikeController } from '$lib/base_controller.ts'
  import StarInput from '$lib/components/StarInput.svelte'
  import type { Snippet } from 'svelte'

  interface Props {
    controller: BrowseLikeController
    /**
     * Renders route-specific <option> elements for the sort_by select.
     */
    sort_options: Snippet
    /**
     * Renders an optional trailing block for additional route-specific
     * controls in the filter row (e.g. search_mode select, group_by input).
     */
    extra_filters?: Snippet
  }

  let { controller, sort_options, extra_filters }: Props = $props()

  const { queryparams, media_selections, settings } = controller.runes

  async function update_search() {
    await queryparams.submit()
    media_selections.clear_current_selection()
  }

  const icon_color = theme.colors.gray[800]
  const icon_size = '22px'
</script>

<form class="contents"
  onsubmit={async (e) => {
    e.preventDefault()
    await update_search()
  }}>
  <div class="flex gap-2 p-3 justify-center items-center w-full">
    <div class="w-full grid grid-cols-[1fr_auto] gap-2">
      <TagAutoCompleteInput
        {controller}
        bind:search_string={queryparams.draft.search_string}
        contextual_query={queryparams.contextual_query}
        kind="search"
        allow_multiple_tags />
      <button
        class="hover:cursor-pointer"
        title="click to {settings.ui.search.advanced_filters.hide ? 'show' : 'hide'} advanced filters"
        type="button"
        onclick={(e) => {
          settings.toggle('ui.search.advanced_filters.hide')
        }}>
        <Icon class="fill-gray-800 hover:fill-gray-600" data={Filter} size={icon_size} fill={icon_color} stroke={"none"} />
      </button>
    </div>
  </div>

  <div class="w-full grid grid-rows-2 justify-space-between items-center text-slate-950 gap-y-2 px-3 pb-3"
    style="display: {settings.ui.search.advanced_filters.hide ? 'none' : 'grid'}; grid-column: 1 / -1">
    <div class="flex flex-row justify-between gap-8">
        <div class="flex gap-1">
          <select
            id="sort_by"
            name="sort_by"
            bind:value={queryparams.draft.sort}
            onchange={update_search}>
            {@render sort_options()}
          </select>
          <button
            class="hover:cursor-pointer"
            title="order by ascending"
            type="button"
            onclick={(e) => {
              if (queryparams.draft.order === 'asc') queryparams.draft.order = 'desc'
              else queryparams.draft.order = 'asc'
              update_search()
            }}>
            {#if queryparams.draft.order === 'asc'}
              <Icon class="fill-gray-800 hover:fill-gray-600" data={ArrowUp} size={icon_size} fill={icon_color} stroke={"none"} />
            {:else}
              <Icon class="fill-gray-800 hover:fill-gray-600" data={ArrowDown} size={icon_size} fill={icon_color} stroke={"none"} />
            {/if}
          </button>
        </div>

        <SelectInput
          options={[
            { label: 'All', value: 'all' },
            { label: 'Animated', value: 'animated' },
            { label: 'Image', value: 'image' },
            { label: 'Video', value: 'video' },
            { label: 'Audio', value: 'audio' },
          ]}
          bind:value={queryparams.draft.media_type}
          onchange={update_search}
        />

        <button
          class={[
            'rounded-lg px-2 border border-2 border-gray-800 hover:border-gray-400',
            queryparams.draft.unread_only
              ? 'bg-gray-800 text-gray-400'
              : '',
          ]}
          type="button"
          onclick={(e) => {
            queryparams.draft.unread_only = !queryparams.draft.unread_only
            update_search()
          }}
          title="Show unread results only"
        >
          Unread
        </button>

        <div class="flex gap-2 text-gray-400">
          <StarInput bind:value={queryparams.draft.stars} star={1} onclick={update_search} />
          <StarInput bind:value={queryparams.draft.stars} star={2} onclick={update_search} />
          <StarInput bind:value={queryparams.draft.stars} star={3} onclick={update_search} />
          <StarInput bind:value={queryparams.draft.stars} star={4} onclick={update_search} />
          <StarInput bind:value={queryparams.draft.stars} star={5} onclick={update_search} />
          <button
            type="button"
            class="px-2 bg-gray-800 rounded-lg"
            onclick={() => {
              switch (queryparams.draft.stars_equality) {
                case 'eq': {
                  queryparams.draft.stars_equality = 'gte'
                  break
                }
                case 'gte': {
                  queryparams.draft.stars_equality = 'eq'
                  break
                }
                case undefined: {
                  queryparams.draft.stars_equality = 'eq'
                  break
                }
                default: {
                  throw new Error(`Unexpected stars_equality ${queryparams.draft.stars_equality}`)
                }
              }
              update_search()
            }}>
            {queryparams.draft.stars_equality === 'eq' ? '=' : '>='}
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
            bind:value={queryparams.draft.filepath}>
        </div>

        {#if extra_filters}
          {@render extra_filters()}
        {/if}
      </div>
    </div>
  <input type="submit" hidden />
</form>
