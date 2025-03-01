<script lang="ts">
  import * as svelte from 'svelte'
  import Scroller from '$lib/components/Scroller.svelte'
  import SearchParams from './components/SearchParams.svelte'
  import SearchResults from './components/SearchResults.svelte'
  import { BrowseController } from './controller.ts'

  const controller = new BrowseController()
  svelte.onMount(controller.onMount)
  controller.runes.focus.stack({component: 'BrowsePage', focus: 'page'})

</script>

<header>
  <SearchParams {controller} />
</header>
<Scroller on:more={e => controller.handlers.paginate_media()}>
  <SearchResults results={controller.runes.search.results} />
  {#if controller.runes.search.loading}
    Loading...
  {/if}
</Scroller>
