<script lang="ts">
  import * as theme from '$lib/theme.ts'
  import Icon from '$lib/components/Icon.svelte'
  import { ChevronLeft, ChevronRight, Pause } from '$lib/icons/mod.ts'
  import type { BrowseController } from '../controller.ts'

  let {controller}: {controller: BrowseController} = $props()

  type SidebarState = 'hidden' | 'shown' | 'dragging'
  let sidebar_state = $state<SidebarState>('hidden')
  let widths = $state({
    screen: 0,
    button: 0,
    sidebar_max: 0,
    sidebar: 100,

    mouse_button_offset: 0,
    mousedown: false,
  })
  $effect(() => {
    widths.sidebar_max = widths.screen - widths.button
    // console.log($state.snapshot(widths))
  })

</script>

<div class="grid grid-cols-[1fr_auto] bg-slate-600">
  {#if sidebar_state !== 'hidden'}
    <div style="width: {widths.sidebar}px">
      I show details.
    </div>
  {/if}

  <button
    class="bg-slate-600 hover:bg-slate-500 border-r-2 border-x-slate-800"
    title="click to {sidebar_state === 'hidden' ? 'open' : 'close'}, drag to resize"
    onmouseup={e => {
      console.log($state.snapshot(sidebar_state))
      widths.mousedown = false
      if (sidebar_state === 'dragging') {}
      else if (sidebar_state == 'shown') sidebar_state = 'hidden'
      else sidebar_state = 'shown'
    }}
    onmousedown={e => {
      widths.mouse_button_offset = e.offsetX
      widths.mousedown = true
    }}
  >
    {#if sidebar_state === 'dragging'}
      <Icon data={Pause} size="22px" fill={theme.colors.lime[600]} stroke={theme.colors.lime[600]} />
    {:else if sidebar_state  === 'hidden'}
      <Icon data={ChevronRight} size="22px" fill={theme.colors.lime[600]} stroke={theme.colors.lime[600]} />
    {:else}
      <Icon data={ChevronLeft} size="22px" fill={theme.colors.lime[600]} stroke={theme.colors.lime[600]} />
    {/if}

  </button>
</div>

<svelte:window
  bind:innerWidth={widths.screen}
  on:mousemove={e => {
    if (widths.mousedown) {
      sidebar_state = 'dragging'
      widths.sidebar = Math.min(e.clientX - widths.mouse_button_offset, widths.sidebar_max)
    }
  }}
  on:mouseup={e => {
    widths.mousedown = false
    if (sidebar_state === 'dragging') sidebar_state = 'shown'
  }}
/>
