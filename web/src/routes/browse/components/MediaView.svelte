<script lang="ts">
  import type { BrowseController } from '../controller.ts'

  interface Props {
    controller: BrowseController
  }

  let {controller}: Props = $props()

  $effect(() => {
    if (controller.runes.media_selections.current_selection.show) {
      dialog.show()
    }
  })

  let dialog: HTMLDialogElement
</script>


<dialog bind:this={dialog} on:close={controller.runes.media_selections.close_media}>
  show me some media for {controller.runes.media_selections.current_selection.media_reference_id}
</dialog>
