<script lang="ts">
  import * as path from '@std/path'
  import type { Forager } from '@forager/core'
  import Sidebar from '$lib/components/Sidebar.svelte'
  import MediaDetailEntry from './MediaDetailEntry.svelte'
  import TagAutoCompleteInput from '$lib/components/TagAutoCompleteInput.svelte'
  import Tag from '$lib/components/Tag.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import {XCircle} from '$lib/icons/mod.ts'

  import { BrowseController } from '../controller.ts'
  let {controller}: {controller: BrowseController} = $props()
  let {dimensions, media_selections} = controller.runes
  let current_selection = media_selections.current_selection

  let new_tag_str = $state<string>('')

  type TagRecord = ReturnType<Forager['tag']['search']>['results'][0]
  let sorted_tags: [string, TagRecord[]][] = $derived.by(() => {
    const grouped_tags: Record<string, TagRecord[]> = {}
    current_selection.media_response?.tags.map(t => {
      if (grouped_tags[t.group] === undefined) {
        grouped_tags[t.group] = []
      }

      grouped_tags[t.group].push(t)
    })

    return Object.entries(grouped_tags).sort((a, b) => a[0].localeCompare(b[0]))
  })
</script>

<Sidebar
  height={dimensions.heights.media_list}
  bind:width={controller.runes.settings.ui.sidebar.size}
  hide={controller.runes.settings.ui.sidebar.hide}
>
  <form
    class="pl-1 pr-3"
    onsubmit={async e => {
      e.preventDefault()
      let media_info = undefined
      let tags: {add: string[]} | undefined
      if (new_tag_str) {
        tags = {add: [new_tag_str]}
      }
      current_selection.media_response!.update(media_info, tags)
      new_tag_str = ''
    }}
    >
    {#if current_selection.media_response}
      <label class="text-green-50" for="tags"><span>Tags</span></label>
      {#each sorted_tags as tag_group_entry, tag_entry_index (tag_group_entry[0])}
        {#each tag_group_entry[1] as tag, tag_index (tag.id)}
          <div class="grid grid-cols-[1fr_auto] items-center gap-1 pb-1">
            <Tag show_group={false} {tag} />
            <button
              class="hover:cursor-pointer"
              title="Remove"
              type="button"
              onclick={async e => {
                await current_selection.media_response.update(undefined, {remove: [`${tag.group}:${tag.name}`]})
              }}>
              <Icon class="fill-green-50 hover:fill-green-300" data={XCircle} size="18px" color="none" />
            </button>
          </div>
        {/each}
      {/each}
      <!--
      {#each current_selection.media_response.tags as tag, tag_index (tag.id)}
        <div class="grid grid-cols-[1fr_auto] items-center gap-1">
          <Tag show_group={false} {tag} />
          <button
            class="hover:cursor-pointer"
            title="Remove"
            type="button"
            onclick={async e => {
              const result = await controller.client.forager.media.update(
                current_selection.media_response?.media_reference.id,
                undefined,
                {remove: [`${tag.group}:${tag.name}`]}
              )
              controller.runes.media_selections.update(controller.runes.search.results, result)
            }}>
            <Icon class="fill-green-50 hover:fill-green-300" data={XCircle} size="18px" color="none" />
          </button>
        </div>
      {/each}
-->
      <TagAutoCompleteInput
        {controller}
        bind:search_string={new_tag_str}
        placeholder=""
        kind="details"
        input_classes="mt-2 bg-slate-400 w-full rounded-sm px-1 text-sm"
      />

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
        editable
        label="Source URL"
        content={current_selection.media_response.media_reference.source_url}/>

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

      {#if current_selection.media_response.media_type === 'media_file'}
        <MediaDetailEntry
          {controller}
          label="Filename"
          content={path.basename(current_selection.media_response.media_file.filepath)}/>

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
  </form>
</Sidebar>
