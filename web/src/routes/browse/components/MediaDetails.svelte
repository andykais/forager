<script lang="ts">
  import Sidebar from '$lib/components/Sidebar.svelte'
  import MediaDetailEntry from './MediaDetailEntry.svelte'

  import { BrowseController } from '../controller.ts'
  let {controller}: {controller: BrowseController} = $props()
  let {dimensions, media_selections} = controller.runes
  let current_selection = media_selections.current_selection
</script>

<Sidebar height={dimensions.heights.media_list}>
  <div class="pl-1 pr-3">
    {#if current_selection.media_response}
      <MediaDetailEntry
        {controller}
        editable
        label="Title"
        content={current_selection.media_response.media_reference.title}/>

      <MediaDetailEntry
        {controller}
        editable
        label="Description"
        content={current_selection.media_response.media_reference.description}/>

      <MediaDetailEntry
        {controller}
        label="Metadata"
        content={current_selection.media_response.media_reference.metadata}/>

      <MediaDetailEntry
        {controller}
        label="Stars"
        content={current_selection.media_response.media_reference.stars}/>

      <MediaDetailEntry
        {controller}
        label="Views"
        content={current_selection.media_response.media_reference.view_count}/>

      <label class="text-green-50" for="tags"><span>Tags</span></label>
      {#each current_selection.media_response.tags as tag, tag_index}
        <div>{tag.group}:{tag.name}</div>
      {/each}

      {#if current_selection.media_response.media_type === 'media_file'}
        <MediaDetailEntry
          {controller}
          label="File"
          content={current_selection.media_response.media_file.filepath}/>
      {/if}

      <!-- TODO we should support datetimes in @andykais/ts-rpc -->
      <MediaDetailEntry
        {controller}
        editable
        label="Added"
        type="datetime-local"
        content={current_selection.media_response.media_reference.created_at}/>

      <MediaDetailEntry
        {controller}
        editable
        label="Created"
        type="datetime-local"
        content={current_selection.media_response.media_reference.source_created_at}/>

    {:else}
      TODO: show tag summary
    {/if}
  </div>
</Sidebar>
