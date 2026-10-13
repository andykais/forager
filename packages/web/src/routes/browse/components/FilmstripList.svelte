<script lang="ts">
  import { tick } from 'svelte'
  import type { BrowseController } from '../controller.ts'
  import Filmstrip from './Filmstrip.svelte'

  let {controller}: {controller: BrowseController} = $props()
  const {media_selections, media_list} = controller.runes

  let list_element: HTMLDivElement

  async function move_filmstrip(direction: 1 | -1) {
    const results = media_list.results
    if (results.length === 0) return
    const current_index = media_selections.current_selection.result_index
    const next_index = Math.min(Math.max(0, current_index + direction), results.length - 1)
    media_selections.select_media(results[next_index], next_index)
    await tick()
    list_element
      .querySelector<HTMLElement>(`[data-filmstrip-index="${next_index}"] [role="listbox"]`)
      ?.focus()
  }

  function filmstrip_list_handler(direction: 1 | -1) {
    return (e: CustomEvent<{data: {keyboard_event: KeyboardEvent}}>) => {
      if (media_selections.current_selection.show) return
      e.detail.data.keyboard_event.preventDefault()
      move_filmstrip(direction)
    }
  }

  controller.keybinds.component_listen({
    NextFilmstrip: filmstrip_list_handler(1),
    PrevFilmstrip: filmstrip_list_handler(-1),
  })
</script>

<div class="py-2" bind:this={list_element}>
  {#each media_list.results as result, result_index (result.media_type === 'grouped' ? `group:${result.group_metadata.value}` : `media:${result.media_reference.id}`)}
    <Filmstrip {controller} {result} {result_index} />
  {/each}
</div>
{#if media_list.loading}
  <div class="px-4 text-gray-400">Loading...</div>
{/if}
