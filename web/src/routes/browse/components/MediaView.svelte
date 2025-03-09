<script lang="ts">
  import type { BrowseController } from '../controller.ts'

  interface Props {
    controller: BrowseController
  }

  controller.keybinds.component_listen({
    Escape: e => {
      dialog.close()
      controller.runes.media_selections.close_media()
    }
  })

  let {controller, media_list_position}: Props = $props()
  let current_selection = controller.runes.media_selections.current_selection

  $effect(() => {
    if (!dialog.open && current_selection.show) {
      dialog.show()
    }
  })

  function video_loader(node: HTMLVideoElement) {
    return {
      update(video_source_url: string) {
        node.load()
      }
    }
  }

  let dialog: HTMLDialogElement
</script>


<dialog
  class="absolute w-full z-10"
  style="height: {controller.runes.dimensions.heights.media_list}px;"
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
          <video
            class="object-contain max-h-full"
            autoplay
            loop
            use:video_loader={`/files/media_file${current_selection.media_response.media_file.filepath}`}
            >
            <source src="/files/media_file{current_selection.media_response.media_file.filepath}">
            <track kind="captions"/> <!-- this exists purely to quiet down an A11y rule -->
          </video>
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
