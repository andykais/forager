<script lang="ts">
  let { more, loading, children, ...props } = $props()
  let observer: IntersectionObserver | undefined = $state()
  let viewport: HTMLDivElement | undefined = $state()
  let end_of_page_element: HTMLDivElement | undefined = $state()

  // my thought is that we should make the observer be the height of two rows of thumbnails
  // that would need to be reactive based on the chosen thumbnail size. 500px might just be a sane default though too
  let bottom_of_screen_offset = 100

  $effect(() => {
    if (!observer && viewport && end_of_page_element) {
      observer = new IntersectionObserver((entries, _observer) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (loading) {
              // we want to avoid hitting more() when we know data is in the process of loading
              // ideally we check if the observer is intersecting after the load is completed
            } else {
              more()
            }
          }
        }
      }, {
        threshold: 0.1,
        root: viewport,
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
  <div class="observer relative" style="top: -{bottom_of_screen_offset}px" bind:this={end_of_page_element}></div>
</div>
