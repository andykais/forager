<script lang="ts">
  import type { BrowseController } from '../controller.ts'

  interface Props {
    controller: BrowseController
  }

  // TODO wire this into settings
  let show_controls = $state<boolean>(false);
  let is_fullscreen = $state(false)

  const refresh_fullscreen_state = () => {
    is_fullscreen = document.fullscreenElement === fullscreen_container
  }

  let {controller}: Props = $props()
  let paused = $state(false)

  const toggle_fit_mode = () => {
    const updated_mode = controller.runes.settings.ui.media_view.fit.mode === 'original'
      ? 'fill'
      : 'original'
    controller.runes.settings.set('ui.media_view.fit.mode', updated_mode)
  }

  const media_fit_classes = $derived.by(() => {
    if (controller.runes.settings.ui.media_view.fit.mode === 'original') {
      return 'w-auto h-auto max-w-full max-h-full'
    }

    if (controller.runes.settings.ui.media_view.fit.edge === 'width') {
      return 'w-full h-auto max-h-full'
    }

    return 'h-full w-auto max-w-full'
  })

  const register_component_keybinds = () => {
    controller.keybinds.component_listen({
      Escape: e => {
        if (document.fullscreenElement === fullscreen_container) {
          document.exitFullscreen()
          return
        }
        dialog.close()
        controller.runes.media_selections.close_media()
      },
      PlayPauseMedia: e => {
        paused = !paused
      },
      OpenMedia: e => {
        /*
        // TODO we need to be aware of the focus when making this call. Currently this will take over hitting "Enter" on the search bar
        media_selections.open_media()
        */
      },
      ToggleMediaControls: async e => {
        show_controls = !show_controls
      },
      ToggleFitMedia: async e => {
        toggle_fit_mode()
      },
      ToggleFullScreen: async e => {
        if (!dialog.open || !controller.runes.media_selections.current_selection.show) return
        e.detail.data.keyboard_event.preventDefault()

        if (document.fullscreenElement === fullscreen_container) {
          await document.exitFullscreen()
        } else {
          await fullscreen_container.requestFullscreen()
        }
      },
      CopyMedia: async e => {
        if (controller.runes.media_selections.current_selection.media_response) {
          if (controller.runes.media_selections.current_selection.media_response.media_type === 'media_file') {
            await navigator.clipboard.writeText(controller.runes.media_selections.current_selection.media_response.media_file.filepath)
          }
        }
      },
    })
  }
  register_component_keybinds()

  let filmstrip_thumbnails
  let filmstrip_height = 50

  $effect(() => {
    if (!dialog.open && controller.runes.media_selections.current_selection.show) {
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
    if (controller.runes.media_selections.current_selection.media_response?.media_type !== 'media_file') {
      return
    }
    return `/files/media_file/${controller.runes.media_selections.current_selection.media_response.media_reference.id}`
  })
  $effect(() => {
    if (media_url) {
      animation_progress = 0
    }
  })


  let dialog: HTMLDialogElement
  let fullscreen_container: HTMLDivElement
  let animation_width = $state(0)
  let animation_progress = $state(0)
</script>


<dialog
  class="absolute w-full z-10 outline-none"
  style="height: {is_fullscreen ? '100dvh' : `${controller.runes.dimensions.heights.media_list}px`};"
  bind:this={dialog}
  onclose={() => {
    refresh_fullscreen_state()
    controller.runes.media_selections.close_media()
  }}>
  <div class="flex items-center justify-center"
  bind:this={fullscreen_container}
  style="height: {is_fullscreen ? '100dvh' : `${controller.runes.dimensions.heights.media_list}px`};"
  >
    {#if controller.runes.media_selections.current_selection.show && controller.runes.media_selections.current_selection.media_response}
      {#if controller.runes.media_selections.current_selection.media_response.media_type === 'media_file'}
        {#if controller.runes.media_selections.current_selection.media_response.media_file.media_type === 'IMAGE'}
          <img
            class="object-contain {media_fit_classes}"
            src={media_url} alt="">
        {:else if controller.runes.media_selections.current_selection.media_response.media_file.media_type === 'VIDEO'}
          <video
            bind:clientWidth={animation_width}
            class="object-contain outline-none {media_fit_classes}"
            autoplay
            loop
            bind:paused
            bind:currentTime={animation_progress}
            controls={show_controls}
            use:video_loader={media_url}
            >
            <source src={media_url}>
            <track kind="captions"/> <!-- this exists purely to quiet down an A11y rule -->
          </video>
          <progress
            class="w-full h-1 absolute bottom-0"
            style="width: {animation_width}px"
            max={controller.runes.media_selections.current_selection.media_response.media_file.duration} value={animation_progress}></progress>
          {#if controller.runes.settings.ui.media_view.filmstrip.enabled}
            <div class="w-full flex flex-row justify-center gap-1 overflow-x-scroll" style="height: {controller.runes.settings.ui.media_view.filmstrip.thumbnail_size}px;">
              {#each controller.runes.media_selections.current_selection.thumbnails.results as thumbnail, index (thumbnail.id)}
                <div class="h-full">
                  <img class="h-full" src="/files/thumbnail/{controller.runes.media_selections.current_selection.media_response.media_reference.id}?index={index}" alt="Thumbnail {index}"></div>
              {/each}
            </div>
          {/if}
        {:else if controller.runes.media_selections.current_selection.media_response.media_file.media_type === 'AUDIO'}
          <img
            class="object-contain {media_fit_classes}"
            src="/files/thumbnail/{controller.runes.media_selections.current_selection.media_response.media_reference.id}" alt="Audio thumbnail">
          <audio
            autoplay
            loop
          >
            <source src={media_url}>
          </audio>
        {/if}
      {:else}
        unhandled media type {controller.runes.media_selections.current_selection.media_response.media_type}
      {/if}
    {/if}
  </div>
</dialog>

<svelte:document on:fullscreenchange={refresh_fullscreen_state} />

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
