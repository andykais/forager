<script lang="ts">
  import * as svelte from 'svelte'
  import {type ApiSpec} from '$lib/api.ts'
  import * as rpc from '@andykais/ts-rpc/client.ts'

  const client = rpc.create<ApiSpec>(`${window.location}rpc/:signature`)
  svelte.onMount(async () => {
    server_time = await client.server_time()
    setInterval(async () => {
      server_time = await client.server_time()
    }, 1000)
  })

  export let server_time: Date
</script>

server time: {server_time}
