<script lang="ts">
  import type { BrowseController } from '../controller.ts'

  interface Props {
    controller: BrowseController
  }

  controller.keybinds.component_listen({
    Escape: e => {
      dialog.close()
    }
  })

  let {controller}: Props = $props()
  let current_selection = controller.runes.media_selections.current_selection

  $effect(() => {
    if (!dialog.open && current_selection.show) {
      dialog.show()
    }
  })

  let dialog: HTMLDialogElement
</script>


<dialog bind:this={dialog} on:close={controller.runes.media_selections.close_media}>
  show me some media for {controller.runes.media_selections.current_selection.media_reference_id}
</dialog>
