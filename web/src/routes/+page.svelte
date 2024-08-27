<script lang="ts">
  import * as svelte from 'svelte'
  import type {ApiSpec} from '$lib/api.ts'
  import * as rpc from '@andykais/ts-rpc/client.ts'

  const build_content_fetcher = <Params, Result>(content_fetcher: (...params: Params) => Promise<Result>) => {
    let state = $state({loading: true, content: null})
    return {
      get loading() { return state.loading },
      get content(): Result { return state.content },
      async fetch(...params: Params) {
        state = {
          content: await content_fetcher(...params),
          loading: false,
        }
      }
    }
  }
  const client = rpc.create<ApiSpec>(`${window.location}rpc/:signature`)
  const search_fetcher = build_content_fetcher(client.forager.search)

  svelte.onMount(async () => {
    await search_fetcher.fetch()
  })

  let server_time: Date = $state(new Date())
</script>


{#if search_fetcher.loading}
  Loading...
{:else}
  {#each search_fetcher.content.result as result}
  {#if result.media_type === 'media_file'}
    <img style="max-width:100px; max-height: 100px" src="/files/thumbnail{result.thumbnails.result[0].filepath}" />
  {:else}
    <div>unimplemented</div>
  {/if}
  {/each}
{/if}

<!--
--->

server time: {server_time}
