<script lang="ts">
  import Header from './Header.svelte'
  import MediaDetails from './MediaDetails.svelte'
  import MediaList from './MediaList.svelte'
  import MediaView from './MediaView.svelte'
  import Footer from './Footer.svelte'
  import type { MediaPageController } from '$lib/media_page_controller.ts'

  interface Props {
    controller: MediaPageController
    focus_component: string
  }

  let {controller, focus_component}: Props = $props()
  let { dimensions, focus } = controller.runes

  // Stack focus on mount
  focus.stack({component: focus_component, focus: 'page'})
</script>

<div class="h-dvh">
  <Header {controller} bind:height={dimensions.heights.header} />
  <div class="grid grid-cols-[auto_1fr]">
    <MediaDetails {controller} />
    <div class="relative">
      <MediaView {controller} />
      <MediaList {controller} />
    </div>
  </div>
  <Footer {controller} bind:height={dimensions.heights.footer} />
</div>

<svelte:window
  on:keydown={controller.keybinds.handler}
  bind:innerHeight={dimensions.heights.screen}
/>
