<script lang="ts">
  import * as svelte from 'svelte'
  import SearchResult from '$lib/components/search_results.svelte'
  import type {ApiSpec} from '$lib/api.ts'
  import {create_content_fetcher} from '$lib/content_fetcher.svelte.ts'
  import * as rpc from '@andykais/ts-rpc/client.ts'

  const client = rpc.create<ApiSpec>(`${window.location}rpc/:signature`)
  const search_fetcher = create_content_fetcher(client.forager.search)

  svelte.onMount(async () => {
    if (search_fetcher.content === null) {
      await search_fetcher.fetch()
    }
  })

  let server_time: Date = $state(new Date())
</script>

{#if search_fetcher.loading}
  Loading...
{:else}
  <SearchResult search_result={search_fetcher.content} />
{/if}
server time: {server_time}
