<script lang="ts">
  import type { BrowseController } from "../controller.ts";
  import * as theme from '$lib/theme.ts'
  import Icon from '$lib/components/Icon.svelte'
  import { Filter } from '$lib/icons/mod.ts'
  import TagAutoCompleteInput from "$lib/components/TagAutoCompleteInput.svelte";

  let {controller}: {controller: BrowseController} = $props()

  interface State {
    search_string: string
    sort: string
    unread_only: boolean
    stars: number | undefined
  }
  let params = $state<State>({
    search_string: '',
    sort: 'source_created_at',
    unread_only: false,
    stars: undefined,
  })

  async function onSubmit() {
    const tags = params.search_string.split(' ').filter(t => t.length > 0)
    await controller.runes.search.clear()
    await controller.runes.search.paginate({query: {tags}})
  }
</script>

<form class="grid grid-rows-1 p-4 bg-gray-700"
  onsubmit={async e => {
    e.preventDefault()
    await onSubmit()
  }}>
  <TagAutoCompleteInput {controller} bind:search_string={params.search_string} focus_on_search_keybind={true} />
</form>
