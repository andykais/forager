<script lang="ts">
  import type { Snippet } from 'svelte'
  import Header from '$lib/components/Header.svelte'
  import SearchParams from '$lib/components/browsable/SearchParams.svelte'
  import MediaDetails from '$lib/components/browsable/MediaDetails.svelte'
  import MediaView from '$lib/components/browsable/MediaView.svelte'
  import MediaList from '$lib/components/browsable/MediaList.svelte'
  import Footer from '$lib/components/browsable/Footer.svelte'
  import type { BrowsableController } from '$lib/base_controller.ts'
  import type { MediaViewRune } from '$lib/runes/index.ts'

  interface Props {
    controller: BrowsableController
    title: string
    /** Route-specific <option> elements for the sort_by select. */
    sort_options: Snippet
    /** Optional route-specific filter controls (e.g. browse's search mode). */
    extra_filters?: Snippet
    /** Optional per-tile footer (e.g. "View series" link, `#index` label). */
    tile_footer?: Snippet<[MediaViewRune]>
  }

  let { controller, title, sort_options, extra_filters, tile_footer }: Props = $props()
  const { dimensions } = controller.runes
</script>

<div class="h-dvh">
  <Header {title} bind:height={dimensions.heights.header}>
    <SearchParams {controller} {sort_options} {extra_filters} />
  </Header>
  <div class="grid grid-cols-[auto_1fr]">
    <MediaDetails {controller} />
    <div class="relative">
      <MediaView {controller} />
      <MediaList {controller} {tile_footer} />
    </div>
  </div>
  <Footer {controller} bind:height={dimensions.heights.footer} />
</div>

<svelte:window
  on:keydown|capture={controller.keybinds.handler}
  bind:innerHeight={dimensions.heights.screen}
/>
