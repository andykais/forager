<script lang="ts">
	import '../app.css';
	
	let { children } = $props();
</script>

<style>
  :global {
    button, input, div, svg {
      transition-property: color, background-color, border, fill, box-shadow;
      transition-duration: 0.1s;
      transition-timing-function:ease-in;
    }

    img {
      transition-property: box-shadow;
      transition-duration: 0.08s;
      transition-timing-function:ease-in;
    }
  }
</style>

<div class="bg-gray-600">
  {@render children?.()}
</div>
