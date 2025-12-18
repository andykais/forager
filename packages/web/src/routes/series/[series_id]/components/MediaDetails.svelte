<script lang="ts">
  import * as path from '@std/path'
  import type { Forager } from '@forager/core'
  import Sidebar from '$lib/components/Sidebar.svelte'
  import MediaDetailEntry from '../../../browse/components/MediaDetailEntry.svelte'
  import TagAutoCompleteInput from '$lib/components/TagAutoCompleteInput.svelte'
  import Tag from '$lib/components/Tag.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import {XCircle} from '$lib/icons/mod.ts'
  import * as parsers from '$lib/parsers.ts'

  import { SeriesController } from '../controller.ts'
  let {controller}: {controller: SeriesController} = $props()
  let {dimensions, media_selections, settings, queryparams} = controller.runes

  let new_tag_str = $state<string>('')

  type TagRecord = ReturnType<Forager['tag']['search']>['results'][0]
  let sorted_tags: [string, TagRecord[]][] = $derived.by(() => {
    const grouped_tags: Record<string, TagRecord[]> = {}
    media_selections.current_selection.media_response?.tags.map(t => {
      if (grouped_tags[t.group] === undefined) {
        grouped_tags[t.group] = []
      }

      grouped_tags[t.group].push(t)
    })

    const entries =  Object.entries(grouped_tags).sort((a, b) => a[0].localeCompare(b[0]))

    entries.sort((a, b) => {
      const a_index = settings.ui.sidebar.tags.order.findIndex(match => {
        return match.group === a[0]
      })
      const b_index = settings.ui.sidebar.tags.order.findIndex(match => {
        return match.group === b[0]
      })
      if (a_index !== -1 && b_index !== -1) {
        return a_index - b_index
      } else if (a_index !== -1) {
        return -1
      } else if (b_index !== -1) {
        return 1
      }
      return a[0].localeCompare(b[0])
    })
    return entries
  })

  controller.keybinds.component_listen({
    ToggleSidebar: e => {
      settings.set('ui.sidebar.hide', !settings.ui.sidebar.hide)
    }
  })
</script>

<Sidebar
  height={dimensions.heights.media_list}
  width={settings.ui.sidebar.size}
  bind:hide={settings.ui.sidebar.hide}
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
      media_selections.current_selection.media_response!.update(media_info, tags)
      new_tag_str = ''
    }}
    >
    {#if media_selections.current_selection.media_response}
      <!-- Series Index (unique to series view) -->
      <MediaDetailEntry
        {controller}
        label="Page"
        content={'#' + media_selections.current_selection.media_response.series_index}/>

      <MediaDetailEntry
        {controller}
        label="Views"
        content={media_selections.current_selection.media_response.media_reference.view_count}/>

      <MediaDetailEntry
        {controller}
        label="Stars"
        content={media_selections.current_selection.media_response.media_reference.stars}/>

      <label class="text-green-50" for="tags"><span>Tags</span></label>
      {#each sorted_tags as tag_group_entry, tag_entry_index (tag_group_entry[0])}
        {#each tag_group_entry[1] as tag, tag_index (tag.id)}
          <div class="grid grid-cols-[1fr_auto] items-center gap-1 pb-1">
            <a href="/browse?tags={parsers.Tag.encode(tag)}">
              <Tag show_group={false} {tag} />
            </a>
            <button
              class="hover:cursor-pointer"
              title="Remove"
              type="button"
              onclick={async e => {
                await media_selections.current_selection.media_response.update(undefined, {remove: [`${tag.group}:${tag.name}`]})
              }}>
              <Icon class="fill-green-50 hover:fill-green-300" data={XCircle} size="18px" color="none" />
            </button>
          </div>
        {/each}
      {/each}
      <TagAutoCompleteInput
        {controller}
        sort_by="updated_at"
        bind:search_string={new_tag_str}
        placeholder=""
        kind="details"
        input_classes="mt-2 bg-slate-400 w-full rounded-sm px-1 text-sm"
      />
      <input type="submit" class='hidden'>

      <MediaDetailEntry
        {controller}
        editable
        hide_if_null
        label="Title"
        content={media_selections.current_selection.media_response.media_reference.title}/>

      <MediaDetailEntry
        {controller}
        editable
        hide_if_null
        label="Description"
        content={media_selections.current_selection.media_response.media_reference.description}/>

      <MediaDetailEntry
        {controller}
        editable
        hide_if_null
        label="Created"
        type="datetime-local"
        content={media_selections.current_selection.media_response.media_reference.source_created_at}/>

      <MediaDetailEntry
        {controller}
        editable
        label="Added"
        type="datetime-local"
        content={media_selections.current_selection.media_response.media_reference.created_at}/>

      <MediaDetailEntry
        {controller}
        hide_if_null
        label="Source URL"
        content={media_selections.current_selection.media_response.media_reference.source_url}/>

      <MediaDetailEntry
        {controller}
        hide_if_null
        label="Metadata"
        content={media_selections.current_selection.media_response.media_reference.metadata}/>

      {#if media_selections.current_selection.media_response.media_type === 'media_file'}
        <MediaDetailEntry
          {controller}
          label="File"
          content={media_selections.current_selection.media_response.media_file.filepath}/>

        <MediaDetailEntry
          {controller}
          label="Filename"
          content={path.basename(media_selections.current_selection.media_response.media_file.filepath)}/>
      {/if}

    {:else}
      <div class="text-gray-400 p-2">
        <p>Series ID: {controller.series_id}</p>
        <p class="mt-2 text-sm">Select an item to view details</p>
      </div>
    {/if}
  </form>
</Sidebar>
