<script lang="ts">
  import { MediaPage } from '$lib/components/media_page/index.ts'
  import { MediaPageController } from '$lib/media_page_controller.ts'

  /** @type {import('./$types').PageProps} */
  let props = $props()

  const series_id = parseInt(props.params.series_id)
  const controller = new MediaPageController(props.data.config, { mode: 'series', series_id })
</script>

<MediaPage {controller} focus_component="SeriesPage" />
