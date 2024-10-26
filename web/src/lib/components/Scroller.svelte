<script lang="ts">
  import {createEventDispatcher, onMount} from 'svelte'

  const dispatch = createEventDispatcher()
  let first_mount = true
  let observer: IntersectionObserver | undefined
  let viewport: HTMLDivElement
  let end_of_page_element: HTMLDivElement

  $: {
    if (!observer && viewport && end_of_page_element) {
      observer = new IntersectionObserver((entries, observer) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            dispatch('more')
          }
        }
      }, {
        // my thought is that we should make the rootMargin be the height of two rows of thumbnails
        // that would need to be reactive based on the chosen thumbnail size. 500px might just be a sane default though too
        rootMargin: "500px",
        threshold: 1.0,
        // root: viewport,
      })

      observer.observe(end_of_page_element)
    }
  }

  onMount(() => {
      dispatch('more')
    if (first_mount) {
      // always trigger one when the element is mounted (an empty page isnt reliable for the intersection observer)
      dispatch('more')
    }
    first_mount = false
  })
</script>


<!--
<svelte:window on:resize={handle_resize} />
-->

<div bind:this={viewport} >
  <slot />
  <div class="observer" bind:this={end_of_page_element}></div>
</div>
