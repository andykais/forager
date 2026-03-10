<script lang="ts">
  import Tag from '$lib/components/Tag.svelte'
  import Datetime from '$lib/components/Datetime.svelte'
  import Scroller from '$lib/components/Scroller.svelte'
  import type { TagsController } from '../controller.ts'

  let { controller }: { controller: TagsController } = $props()
  const { queryparams } = controller.runes

  type SortBy = typeof queryparams.draft.sort_by

  function sort_by(column: SortBy) {
    if (queryparams.draft.sort_by === column) {
      queryparams.draft.order = queryparams.draft.order === 'asc' ? 'desc' : 'asc'
    } else {
      queryparams.draft.sort_by = column
      queryparams.draft.order = 'desc'
    }
    queryparams.submit()
  }

  function sort_indicator(column: SortBy): string {
    if (queryparams.current.sort_by !== column) return ''
    return queryparams.current.order === 'asc' ? ' \u25B2' : ' \u25BC'
  }
</script>

{#if queryparams.results.length === 0 && !queryparams.loading}
  <div class="p-4">
    <p class="text-slate-400">No tags found.</p>
  </div>
{:else}
  <div class="p-4 text-sm text-slate-400 mb-0">{queryparams.total} tags</div>
  <Scroller
    loading={queryparams.loading}
    more={() => queryparams.load_more()}
    class="overflow-y-auto p-4 pt-0"
    style="max-height: calc(100dvh - 120px)"
  >
    <table class="w-full text-sm text-left text-slate-300">
      <thead class="text-sm text-slate-800 border-b border-slate-500 sticky top-0 bg-gray-600">
        <tr>
          <th class="py-2 px-3">Tag</th>
          <th class="py-2 px-3">Group</th>
          <th class="py-2 px-3 text-right">
            <button class="hover:text-slate-200 hover:cursor-pointer" onclick={() => sort_by('media_reference_count')}>
              Media{sort_indicator('media_reference_count')}
            </button>
          </th>
          <th class="py-2 px-3 text-right">
            <button class="hover:text-slate-200 hover:cursor-pointer" onclick={() => sort_by('unread_media_reference_count')}>
              Unread{sort_indicator('unread_media_reference_count')}
            </button>
          </th>
          <th class="py-2 px-3 text-right">Aliases</th>
          <th class="py-2 px-3 text-right">Parents</th>
          <th class="py-2 px-3">
            <button class="hover:text-slate-200 hover:cursor-pointer" onclick={() => sort_by('created_at')}>
              Created{sort_indicator('created_at')}
            </button>
          </th>
          <th class="py-2 px-3">
            <button class="hover:text-slate-200 hover:cursor-pointer" onclick={() => sort_by('updated_at')}>
              Updated{sort_indicator('updated_at')}
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        {#each queryparams.results as tag (tag.id)}
          <tr class="border-b border-slate-700 hover:bg-slate-700">
            <td class="py-2 px-3">
              <a
                href="/tags/{encodeURIComponent(tag.slug)}"
                class="hover:underline">
                <Tag {tag} show_group={false} hide_count />
              </a>
            </td>
            <td class="py-2 px-3 text-slate-400">{tag.group || '(default)'}</td>
            <td class="py-2 px-3 text-right">{tag.media_reference_count}</td>
            <td class="py-2 px-3 text-right">{tag.unread_media_reference_count}</td>
            <td class="py-2 px-3 text-right">{tag.alias_count || ''}</td>
            <td class="py-2 px-3 text-right">{tag.parent_count || ''}</td>
            <td class="py-2 px-3"><Datetime value={tag.created_at} class="text-slate-400" /></td>
            <td class="py-2 px-3"><Datetime value={tag.updated_at} class="text-slate-400" /></td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if queryparams.loading}
      <p class="text-slate-400 text-sm p-2">Loading...</p>
    {/if}
  </Scroller>
{/if}
