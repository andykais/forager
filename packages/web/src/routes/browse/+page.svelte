<script lang="ts">
  import MediaDetails from '$lib/components/browse_like/MediaDetails.svelte'
  import MediaList from '$lib/components/browse_like/MediaList.svelte'
  import MediaView from '$lib/components/browse_like/MediaView.svelte'
  import Footer from '$lib/components/browse_like/Footer.svelte'
  import SearchParams from '$lib/components/browse_like/SearchParams.svelte'
  import Header from '$lib/components/Header.svelte'
  import SelectInput from '$lib/components/SelectInput.svelte'

  import { BrowseController } from './controller.ts'

  /** @type {import('./$types').PageProps} */
  let props = $props()

  const controller = new BrowseController(props.data.config)
  let { dimensions, focus, queryparams } = controller.runes
  focus.stack({ component: 'BrowsePage', focus: 'page' })
</script>

{#snippet sort_options()}
  <option value="source_created_at">Created At</option>
  <option value="created_at">Added On</option>
  <option value="updated_at">Updated At</option>
  <option value="view_count">View Count</option>
  <option value="last_viewed_at">Last Viewed</option>
  <option value="duration">Duration</option>
  {#if queryparams.draft.search_mode === 'group_by'}
    <option value="count">Count</option>
  {/if}
{/snippet}

{#snippet extra_filters()}
  <SelectInput
    label="Search Mode"
    options={[
      { label: 'Media', value: 'media' },
      { label: 'Grouped', value: 'group_by' },
      { label: 'Filesystem', value: 'filesystem' },
    ]}
    onchange={() => {
      if (queryparams.draft.search_mode !== 'group_by') {
        queryparams.draft.group_by = undefined
      }
    }}
    bind:value={queryparams.draft.search_mode}
  />

  {#if queryparams.draft.search_mode == "group_by"}
    <div class="flex gap-2">
      <label class="" for="group_by">Group By:</label>
      <input
        class="rounded-lg py-1 px-3 text-slate-100 bg-gray-800 text-sm"
        name="group_by"
        type="text"
        bind:value={queryparams.draft.group_by}>
    </div>
  {/if}
{/snippet}

<div class="h-dvh">
  <Header title={queryparams.human_readable_summary || 'Forager'} bind:height={dimensions.heights.header}>
    <SearchParams {controller} {sort_options} {extra_filters} />
  </Header>
  <div class="grid grid-cols-[auto_1fr]">
    <MediaDetails {controller} />
    <div class="relative">
      <MediaView {controller} />
      <MediaList {controller} show_series_link />
    </div>
  </div>
  <Footer {controller} bind:height={dimensions.heights.footer} />
</div>

<svelte:window
  on:keydown={controller.keybinds.handler}
  bind:innerHeight={dimensions.heights.screen}
/>
