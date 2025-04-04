<script lang="ts">
  import type { BrowseController } from '../controller.ts'

  interface Props {
    controller: BrowseController
  }

  controller.keybinds.component_listen({
    Escape: e => {
      dialog.close()
      controller.runes.media_selections.close_media()
    },
    PlayPauseMedia: e => {
      paused = !paused
    }
  })

  let {controller}: Props = $props()
  let current_selection = controller.runes.media_selections.current_selection
  let paused = $state(false)

  let filmstrip_thumbnails
  let filmstrip_height = 50

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

  let media_url = $derived.by(() => {
    if (current_selection.media_response?.media_type !== 'media_file') {
      return
    }
    const escaped_path = current_selection.media_response.media_file.filepath
      // .replace(/$\//, '')
      //.replaceAll('?', '%3F')
    const escaped_url = `/files/media_file/${encodeURIComponent(escaped_path)}`
    return escaped_url
  })

  let dialog: HTMLDialogElement
</script>


<dialog
  class="absolute w-full z-10 outline-none"
  style="height: {controller.runes.dimensions.heights.media_list}px;"
  bind:this={dialog}
  onclose={controller.runes.media_selections.close_media}>
  <div class="grid justify-items-center items-center h-full">
    {#if current_selection.show && current_selection.media_response}
      {#if current_selection.media_response.media_type === 'media_file'}
        {#if current_selection.media_response.media_file.media_type === 'IMAGE'}
          <img
            class="object-contain max-h-full"
            src={media_url} alt="">
        {:else if current_selection.media_response.media_file.media_type === 'VIDEO'}
          <video
            class="object-contain max-h-full outline-none"
            autoplay
            loop
            bind:paused
            use:video_loader={media_url}
            >
            <source src={media_url}>
            <track kind="captions"/> <!-- this exists purely to quiet down an A11y rule -->
          </video>
          {#if controller.runes.settings.ui.media_view.filmstrip.enabled}
            <div class="w-full flex flex-row justify-center gap-1 overflow-x-scroll" style="height: {controller.runes.settings.ui.media_view.filmstrip.thumbnail_size}px;">
              {#each current_selection.media_response.thumbnails.results as thumbnail}
                <div class="h-full">
                  <img class="h-full" src="/files/thumbnail{thumbnail.filepath}" alt=""></div>
              {/each}
            </div>
          {/if}
        {:else if current_selection.media_response.media_file.media_type === 'AUDIO'}
          <img
            class="object-contain max-h-full"
            src="/files/thumbnail{current_selection.media_response.thumbnails.results[0].filepath}" alt="">
          <audio
            autoplay
            loop
          >
            <source src={media_url}>
          </audio>
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
