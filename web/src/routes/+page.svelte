<script lang="ts">
  import * as svelte from 'svelte'
  import Scroller from '$lib/components/Scroller.svelte'
  import SearchResult from '$lib/components/SearchResults.svelte'
  import type {ApiSpec} from '$lib/api.ts'
  import {create_pagination_fetcher} from '$lib/runes/index.ts'
  import {create_content_fetcher} from '$lib/runes/content_fetcher.svelte.ts'
  import * as rpc from '@andykais/ts-rpc/client.ts'

  const client = rpc.create<ApiSpec>(`${window.location}rpc/:signature`)
  const search_fetcher = create_pagination_fetcher(client.forager.search)

  svelte.onMount(async () => {
    const config = await client.config()
  })

  async function handle_scroller_more() {
    await search_fetcher.fetch()
  }
</script>

<Scroller on:more={handle_scroller_more}>
  <SearchResult results={search_fetcher.results} />
  {#if search_fetcher.loading}
    Loading...
  {/if}
</Scroller>
