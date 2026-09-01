<script lang="ts">
  import { page } from '$app/state'
  import BrowsableShell from '$lib/components/browsable/BrowsableShell.svelte'
  import GroupTileLink from '$lib/components/browsable/GroupTileLink.svelte'
  import { MediaGroupRune, type MediaViewRune } from '$lib/runes/index.ts'

  import { SeriesController } from './controller.ts'

  /** @type {import('./$types').PageProps} */
  let props = $props()

  const series_id_param = page.params.series_id
  const series_id_number = Number(series_id_param)
  if (!Number.isFinite(series_id_number) || series_id_number <= 0) {
    throw new Error(`Invalid series_id: ${series_id_param}`)
  }

  const controller = new SeriesController(props.data.config, series_id_number)
  let { focus } = controller.runes
  focus.stack({ component: 'SeriesPage', focus: 'page' })

  let series_title = $state<string | undefined>(undefined)

  $effect(() => {
    controller.client.forager.series.get({ series_id: series_id_number })
      .then((response: { media_reference: { media_series_name?: string | null; title?: string | null } }) => {
        series_title = response.media_reference.media_series_name
          ?? response.media_reference.title
          ?? undefined
      })
      .catch(() => {
        series_title = undefined
      })
  })

  let page_title = $derived(
    series_title
      ? `${series_title} (Series)`
      : `Series #${series_id_number}`,
  )
</script>

{#snippet tile_footer(result: MediaViewRune)}
  {#if result instanceof MediaGroupRune}
    <GroupTileLink {controller} {result} />
  {:else if result.series_index !== undefined}
    <span title="Page in series">#{result.series_index}</span>
  {/if}
{/snippet}

<BrowsableShell {controller} title={page_title} {tile_footer} />
