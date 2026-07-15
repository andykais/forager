<script lang="ts">
  import BrowsableShell from '$lib/components/browsable/BrowsableShell.svelte'
  import SelectInput from '$lib/components/SelectInput.svelte'
  import SearchLink from '$lib/components/browsable/SearchLink.svelte'
  import { MediaSeriesRune, MediaGroupRune, type MediaViewRune } from '$lib/runes/index.ts'

  import { BrowseController } from './controller.ts'

  /** @type {import('./$types').PageProps} */
  let props = $props()

  const controller = new BrowseController(props.data.config)
  let { focus, queryparams } = controller.runes
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

{#snippet tile_footer(result: MediaViewRune)}
  {#if result instanceof MediaSeriesRune}
    <a
      class="text-green-300 hover:text-green-400 hover:underline"
      href={`/series/${result.media_reference.id}`}
      title="View this media series"
      onclick={(e) => e.stopPropagation()}
    >View series</a>
  {:else if result instanceof MediaGroupRune}
    <SearchLink
      class="hover:text-green-500 hover:bg-gray-700 px-2 rounded-sm"
      {controller}
      params={queryparams.merge({ mode: 'media', tags: `${queryparams.current.group_by ?? ''}:${result.group_metadata.value}` })}
    >{result.group_metadata.value}</SearchLink>
  {/if}
{/snippet}

<BrowsableShell
  {controller}
  title={queryparams.human_readable_summary || 'Forager'}
  {sort_options}
  {extra_filters}
  {tile_footer}
/>
