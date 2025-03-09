<script lang="ts">
  import {onMount} from 'svelte'

  let { more, children, position_y = $bindable(), ...props } = $props()
  let first_mount = true
  let observer: IntersectionObserver | undefined = $state()
  let viewport: HTMLDivElement | undefined = $state()
  let end_of_page_element: HTMLDivElement | undefined = $state()

  $effect(() => {
    if (!observer && viewport && end_of_page_element) {
      observer = new IntersectionObserver((entries, _observer) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            more()
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
  })

  onMount(() => {
      more()
    if (first_mount) {
      // always trigger one when the element is mounted (an empty page isnt reliable for the intersection observer)
      more()
    }
    first_mount = false
  })
</script>


<!--
<svelte:window on:resize={handle_resize} />
-->

<div bind:this={viewport} class={props.class} style={props.style} bind:offsetHeight={position_y} >
  {@render children?.()}
  <div class="observer" bind:this={end_of_page_element}></div>
</div>
