<script lang="ts">
  import * as theme from '$lib/theme.ts'
  import Icon from '$lib/components/Icon.svelte'
  import { ChevronLeft, ChevronRight, Pause } from '$lib/icons/mod.ts'

  const icon_color = theme.colors.green[500]
  let props = $props()

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
  })

</script>

<div class="grid grid-cols-[1fr_auto] bg-slate-600">
  {#if sidebar_state !== 'hidden'}
    <div
      class="overflow-x-hidden"
      style="width: {widths.sidebar}px">
      {@render props.children?.()}
    </div>
  {/if}

  <button
    class="bg-slate-600 hover:bg-slate-500 border-r-2 border-x-slate-800"
    title="click to {sidebar_state === 'hidden' ? 'open' : 'close'}, drag to resize"
    onmouseup={e => {
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
      <Icon data={Pause} size="22px" fill={icon_color} stroke={icon_color} />
    {:else if sidebar_state  === 'hidden'}
      <Icon data={ChevronRight} size="22px" fill={icon_color} stroke={icon_color} />
    {:else}
      <Icon data={ChevronLeft} size="22px" fill={icon_color} stroke={icon_color} />
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
