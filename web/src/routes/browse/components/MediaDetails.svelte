<script lang="ts">
  import Sidebar from '$lib/components/Sidebar.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { Copy } from '$lib/icons/mod.ts'

  import { BrowseController } from '../controller.ts'
  let {controller}: {controller: BrowseController} = $props()
  let current_selection = controller.runes.media_selections.current_selection
</script>

<Sidebar>
  <div class="px-1">
    {#if current_selection.media_response}
      <label for="title">Title</label>
      <input class="bg-slate-400" type="text" value={current_selection.media_response.media_reference.title}>
      <label for="title">Description</label>
      <input class="bg-slate-400" type="text" value={current_selection.media_response.media_reference.description}>

      {#if current_selection.media_response.media_type === 'media_file'}
        <h3>File</h3>
        <Icon data={Copy} />
        <span class="bg-slate-400 font-mono text-nowrap">{current_selection.media_response.media_file.filepath}</span>
      {/if}

      <h3>Tags</h3>
      {#each current_selection.media_response.tags as tag, tag_index}
        <div>{tag.group}:{tag.name}</div>
      {/each}

      <h3>Added</h3>
      <span>{current_selection.media_response.media_reference.created_at}</span>
      <h3>Created</h3>
      <span>{current_selection.media_response.media_reference.source_created_at ?? 'Unknown'}</span>
    {:else}
      TODO: show tag summary
    {/if}
  </div>
</Sidebar>
