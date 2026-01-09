<script lang="ts">
  import type { MediaPageController } from '$lib/media_page_controller.ts'

  interface Props {
    controller: MediaPageController
  }

  let show_controls = $state<boolean>(false);

  controller.keybinds.component_listen({
    Escape: e => {
      dialog.close()
      controller.runes.media_selections.close_media()
    },
    PlayPauseMedia: e => {
      paused = !paused
    },
    OpenMedia: e => {
    },
    ToggleMediaControls: async e => {
      show_controls = !show_controls
    },
    CopyMedia: async e => {
      if (media_selections.current_selection.media_response) {
        if (media_selections.current_selection.media_response.media_type === 'media_file') {
          await navigator.clipboard.writeText(media_selections.current_selection.media_response.media_file.filepath)
        }
      }
    },
  })

  let {controller}: Props = $props()
  const {media_selections} = controller.runes
  let paused = $state(false)

  let filmstrip_height = 50

  $effect(() => {
    if (!dialog.open && media_selections.current_selection.show) {
      dialog.show()
    }
  })

  function video_loader(node: HTMLVideoElement) {
    return {
      update(video_source_url: string) {
        animation_progress = 0
        node.load()
      }
    }
  }

  let media_url = $derived.by(() => {
    if (media_selections.current_selection.media_response?.media_type !== 'media_file') {
      return
    }
    const escaped_path = media_selections.current_selection.media_response.media_file.filepath
    const escaped_url = `/files/media_file/${encodeURIComponent(escaped_path)}`
    return escaped_url
  })
  $effect(() => {
    if (media_url) {
      animation_progress = 0
    }
  })


  let dialog: HTMLDialogElement
  let animation_width = $state(0)
  let animation_progress = $state(0)
</script>


<dialog
  class="absolute w-full z-10 outline-none"
  style="height: {controller.runes.dimensions.heights.media_list}px;"
  bind:this={dialog}
  onclose={controller.runes.media_selections.close_media}>
  <div class="flex items-center justify-center"
  style="height: {controller.runes.dimensions.heights.media_list}px;"
  >
    {#if media_selections.current_selection.show && media_selections.current_selection.media_response}
      {#if media_selections.current_selection.media_response.media_type === 'media_file'}
        {#if media_selections.current_selection.media_response.media_file.media_type === 'IMAGE'}
          <img
            class="object-contain max-h-full"
            src={media_url} alt="">
        {:else if media_selections.current_selection.media_response.media_file.media_type === 'VIDEO'}
          <video
            bind:clientWidth={animation_width}
            class="object-contain max-h-full outline-none"
            autoplay
            loop
            bind:paused
            bind:currentTime={animation_progress}
            controls={show_controls}
            use:video_loader={media_url}
            >
            <source src={media_url}>
            <track kind="captions"/>
          </video>
          <progress
            class="w-full h-1 absolute bottom-0"
            style="width: {animation_width}px"
            max={media_selections.current_selection.media_response.media_file.duration} value={animation_progress}></progress>
          {#if controller.runes.settings.ui.media_view.filmstrip.enabled}
            <div class="w-full flex flex-row justify-center gap-1 overflow-x-scroll" style="height: {controller.runes.settings.ui.media_view.filmstrip.thumbnail_size}px;">
              {#each media_selections.current_selection.thumbnails.results as thumbnail}
                <div class="h-full">
                  <img class="h-full" src="/files/thumbnail{thumbnail.filepath}" alt=""></div>
              {/each}
            </div>
          {/if}
        {:else if media_selections.current_selection.media_response.media_file.media_type === 'AUDIO'}
          <img
            class="object-contain max-h-full"
            src="/files/thumbnail{media_selections.current_selection.media_response.thumbnails.results[0].filepath}" alt="">
          <audio
            autoplay
            loop
          >
            <source src={media_url}>
          </audio>
        {/if}
      {:else}
        unhandled media type {media_selections.current_selection.media_response.media_type}
      {/if}
    {/if}
  </div>
</dialog>

<style>
  dialog {
    background-color: hsl(100 0% 0% / 45%);
  }

  progress {
    background-color: initial;
    -webkit-appearence:none;
  }
  progress::-webkit-progress-bar {
    background-color: initial;
  }
  progress::-webkit-progress-value {
    background-color: white;
  }
  progress::-moz-progress-bar {
    background-color: white;
  }
</style>
