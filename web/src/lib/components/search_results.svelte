<script lang="ts">

  let {search_result} = $props()
</script>

<style>
  .container-masonry {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    grid-template-rows: masonry;
    masonry-auto-flow: next ;
  }
</style>


<div class="container-masonry p-4">
  {#each search_result.result as result}
  {#if result.media_type === 'media_file'}
    <button class="
      p-1
      inline-flex items-center justify-center
      shadow shadow-slate-700 bg-slate-500
      border-2 border-slate-500
      hover:border-slate-200 hover:border-2
      rounded-md">
      <img
        style="max-width:100px; max-height: 100px"
        src="/files/thumbnail{result.thumbnails.result[0].filepath}"
        alt="Failed to load /files/thumbnail{result.thumbnails.result[0].filepath}"/>
    </button>
  {:else}
    <div>unimplemented</div>
  {/if}
  {/each}
</div>
