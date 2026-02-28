<script lang="ts" module>
  import type { BaseController } from '$lib/base_controller.ts'
  import type { MediaListRune, SettingsRune, MediaSelectionsRune, create_focuser, create_dimensional_rune } from '$lib/runes/index.ts'

  // Define the shape of a media browser controller without importing concrete implementations
  export interface MediaBrowserController extends BaseController {
    runes: {
      media_list: MediaListRune
      focus: ReturnType<typeof create_focuser>
      dimensions: ReturnType<typeof create_dimensional_rune>
      settings: SettingsRune
      media_selections: MediaSelectionsRune
      queryparams: any // Different queryparams types for browse vs series
    }
  }
</script>

<script lang="ts">
  import MediaDetails from './MediaDetails.svelte'
  import MediaView from './MediaView.svelte'
  import Footer from './Footer.svelte'
  import type { Snippet } from 'svelte'

  interface Props {
    controller: MediaBrowserController
    header: Snippet<[{ controller: MediaBrowserController }]>
    media_list: Snippet<[{ controller: MediaBrowserController }]>
  }

  let { controller, header, media_list }: Props = $props()
  let { dimensions } = controller.runes
</script>

<div class="h-dvh">
  {@render header({ controller })}
  <div class="grid grid-cols-[auto_1fr]">
    <MediaDetails {controller} />
    <div class="relative">
      <MediaView {controller} />
      {@render media_list({ controller })}
    </div>
  </div>
  <Footer {controller} bind:height={dimensions.heights.footer} />
</div>

<svelte:window
  on:keydown={controller.keybinds.handler}
  bind:innerHeight={dimensions.heights.screen}
/>
