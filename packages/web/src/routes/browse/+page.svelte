<script lang="ts">
  import BrowsableShell from '$lib/components/browsable/BrowsableShell.svelte'
  import GroupTileLink from '$lib/components/browsable/GroupTileLink.svelte'
  import { MediaSeriesRune, MediaGroupRune, type MediaViewRune } from '$lib/runes/index.ts'

  import { BrowseController } from './controller.ts'

  /** @type {import('./$types').PageProps} */
  let props = $props()

  const controller = new BrowseController(props.data.config)
  let { focus, queryparams } = controller.runes
  focus.stack({ component: 'BrowsePage', focus: 'page' })
</script>

{#snippet tile_footer(result: MediaViewRune)}
  {#if result instanceof MediaGroupRune}
    <GroupTileLink {controller} {result} />
  {:else if result instanceof MediaSeriesRune}
    <a
      class="text-green-300 hover:text-green-400 hover:underline"
      href={`/series/${result.media_reference.id}`}
      title="View this media series"
      onclick={(e) => e.stopPropagation()}
    >View series</a>
  {/if}
{/snippet}

<BrowsableShell
  {controller}
  title={queryparams.human_readable_summary || 'Forager'}
  {tile_footer}
/>
