<script lang="ts">
  import * as rpc from '@andykais/ts-rpc/client.ts'

  export let rpc_keys = Object.keys(rpc)
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
rpc keys: {rpc_keys}
