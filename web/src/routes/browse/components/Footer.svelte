<script lang="ts">
  import type { BrowseController } from '../controller.ts'

  let {controller, height = $bindable()}: {controller: BrowseController, height: number} = $props()
</script>


<footer
  class="bg-gray-700 flex justify-end px-2 py-1"
  bind:clientHeight={height}
>
  <span class="text-green-100">
    Found {controller.runes.search.results.length} search results
  </span>
</footer>
