<script lang="ts">
  let { more, children, ...props } = $props()
  let first_mount = true
  let observer: IntersectionObserver | undefined = $state()
  let viewport: HTMLDivElement | undefined = $state()
  let end_of_page_element: HTMLDivElement | undefined = $state()

  $effect(() => {
    if (!observer && viewport && end_of_page_element) {
      observer = new IntersectionObserver((entries, _observer) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (first_mount) {
              // NOTE this is a tad messy, but we trust whoever is in charge of pagination to call this the first time (in this case our consumer the SearchParams needs to read the queryparams before making the first search call)
              first_mount = false
            } else {
              more()
            }
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
</script>


<!--
<svelte:window on:resize={handle_resize} />
-->

<div bind:this={viewport} class={props.class} style={props.style}>
  {@render children?.()}
  <div class="observer" bind:this={end_of_page_element}></div>
</div>
