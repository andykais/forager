<script lang="ts">
  import type { BrowseController } from '../controller.ts'

  interface Props {
    controller: BrowseController
    height: number
    media_list_position: number
  }

  controller.keybinds.component_listen({
    Escape: e => {
      dialog.close()
    }
  })

  let {controller, height, media_list_position}: Props = $props()
  let current_selection = controller.runes.media_selections.current_selection

  $effect(() => {
    if (!dialog.open && current_selection.show) {
      console.log('dialog show?')
      dialog.show()
    }
  })

  let dialog: HTMLDialogElement
</script>


<dialog
  class="absolute w-full"
  style="height: {height}px; top: {media_list_position}px"
  bind:this={dialog}
  onclose={controller.runes.media_selections.close_media}>
  <div class="grid justify-items-center items-center h-full">
    {#if current_selection.show && current_selection.media_response}
      {#if current_selection.media_response.media_type === 'media_file'}
        {#if current_selection.media_response.media_file.media_type === 'IMAGE'}
          <img
            class="object-contain max-h-full"
            src="/files/media_file{current_selection.media_response.media_file.filepath}" alt="">
        {:else if current_selection.media_response.media_file.media_type === 'VIDEO'}
          video
        {/if}
      {:else}
        unhandled media type {current_selection.media_response.media_type}
      {/if}
    {/if}
  </div>
</dialog>

<style>
  dialog {
    background-color: hsl(100 0% 0% / 45%);
  }
</style>
