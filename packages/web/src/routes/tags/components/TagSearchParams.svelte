<script lang="ts">
  import Icon from '$lib/components/Icon.svelte'
  import { ArrowDown, ArrowUp } from '$lib/icons/mod.ts'
  import * as theme from '$lib/theme.ts'
  import type { TagsController } from '../controller.ts'

  let { controller }: { controller: TagsController } = $props()
  const { queryparams } = controller.runes

  const icon_color = theme.colors.gray[800]
  const icon_size = '22px'
</script>

<form class="flex flex-col p-3 w-full"
  onsubmit={async e => {
    e.preventDefault()
    await queryparams.submit()
  }}>
  <div class="flex gap-2 items-center">
    <input
      class="flex-grow rounded-lg py-0.5 px-3 text-slate-100 bg-gray-800"
      type="text"
      name="search"
      placeholder="genre:adventure..."
      autocomplete="off"
      bind:value={queryparams.draft.search_string}
    />

    <div class="flex gap-1">
      <select
        class="rounded-lg py-1 px-2 text-slate-950"
        bind:value={queryparams.draft.sort_by}
        onchange={() => queryparams.submit()}>
        <option value="media_reference_count">Media Count</option>
        <option value="unread_media_reference_count">Unread Count</option>
        <option value="created_at">Created At</option>
        <option value="updated_at">Updated At</option>
      </select>

      <button
        class="hover:cursor-pointer"
        type="button"
        title="Toggle sort order"
        onclick={() => {
          queryparams.draft.order = queryparams.draft.order === 'asc' ? 'desc' : 'asc'
          queryparams.submit()
        }}>
        {#if queryparams.draft.order === 'asc'}
          <Icon class="fill-gray-800 hover:fill-gray-600" data={ArrowUp} size={icon_size} fill={icon_color} stroke="none" />
        {:else}
          <Icon class="fill-gray-800 hover:fill-gray-600" data={ArrowDown} size={icon_size} fill={icon_color} stroke="none" />
        {/if}
      </button>
    </div>
  </div>
  <input type="submit" hidden />
</form>
