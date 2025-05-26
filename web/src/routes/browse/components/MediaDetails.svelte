<script lang="ts">
  import * as path from '@std/path'
  import type { Forager } from '@forager/core'
  import Sidebar from '$lib/components/Sidebar.svelte'
  import MediaDetailEntry from './MediaDetailEntry.svelte'
  import TagAutoCompleteInput from '$lib/components/TagAutoCompleteInput.svelte'
  import Tag from '$lib/components/Tag.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import {XCircle} from '$lib/icons/mod.ts'
  import * as parsers from '$lib/parsers.ts'

  import { BrowseController } from '../controller.ts'
  let {controller}: {controller: BrowseController} = $props()
  let {dimensions, media_selections, settings, queryparams} = controller.runes
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
</script>

<Sidebar
  height={dimensions.heights.media_list}
  bind:width={settings.ui.sidebar.size}
  hide={settings.ui.sidebar.hide}
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
            <a
              href={queryparams.serialize(queryparams.extend('tag', parsers.Tag.encode(tag)))}
              onclick={async e => {
                if (e.ctrlKey || e.shiftKey) return
                e.preventDefault()
                await queryparams.goto(queryparams.extend('tag', parsers.Tag.encode(tag)))
              }}
            >
              <Tag show_group={false} {tag} />
            </a>
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
