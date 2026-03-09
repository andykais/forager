<script lang="ts">
  import Tag from '$lib/components/Tag.svelte'
  import Datetime from '$lib/components/Datetime.svelte'
  import type { TagsController } from '../controller.ts'

  let { controller }: { controller: TagsController } = $props()
  const { queryparams } = controller.runes
</script>

<div class="p-4">
  {#if queryparams.loading}
    <p class="text-slate-400">Loading...</p>
  {:else if queryparams.results.length === 0}
    <p class="text-slate-400">No tags found.</p>
  {:else}
    <div class="text-sm text-slate-400 mb-2">{queryparams.total} tags</div>
    <table class="w-full text-sm text-left text-slate-300">
      <thead class="text-xs uppercase text-slate-400 border-b border-slate-500">
        <tr>
          <th class="py-2 px-3">Tag</th>
          <th class="py-2 px-3">Group</th>
          <th class="py-2 px-3 text-right">Media</th>
          <th class="py-2 px-3 text-right">Unread</th>
          <th class="py-2 px-3">Created</th>
          <th class="py-2 px-3">Updated</th>
        </tr>
      </thead>
      <tbody>
        {#each queryparams.results as tag (tag.id)}
          <tr class="border-b border-slate-700 hover:bg-slate-700">
            <td class="py-2 px-3">
              <a
                href="/tags/{encodeURIComponent(tag.slug)}"
                class="hover:underline">
                <Tag {tag} transparent show_group={false} />
              </a>
            </td>
            <td class="py-2 px-3 text-slate-400">{tag.group || '(default)'}</td>
            <td class="py-2 px-3 text-right">{tag.media_reference_count}</td>
            <td class="py-2 px-3 text-right">{tag.unread_media_reference_count}</td>
            <td class="py-2 px-3"><Datetime value={tag.created_at} class="text-slate-400" /></td>
            <td class="py-2 px-3"><Datetime value={tag.updated_at} class="text-slate-400" /></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
