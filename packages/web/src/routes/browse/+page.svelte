<script lang="ts">
  import { MediaPage } from '$lib/components/media_page/index.ts'
  import { MediaPageController } from '$lib/media_page_controller.ts'

  /** @type {import('./$types').PageProps} */
  let props = $props()

  const controller = new MediaPageController(props.data.config, { mode: 'browse' })
</script>

<MediaPage {controller} focus_component="BrowsePage" />
