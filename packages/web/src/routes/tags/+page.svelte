<script lang="ts">
  import TagSearchParams from './components/TagSearchParams.svelte'
  import TagSearchResults from './components/TagSearchResults.svelte'
  import { TagsController } from './controller.ts'

  let props = $props()
  const controller = new TagsController(props.data.config)
</script>

<div class="h-dvh flex flex-col">
  <header class="border-b border-slate-500 flex items-center justify-between px-4 py-2">
    <h1 class="text-lg text-slate-200 font-semibold">Tags</h1>
    <a href="/browse" class="text-sm text-slate-400 hover:text-slate-200">Browse Media</a>
  </header>
  <TagSearchParams {controller} />
  <div class="flex-grow overflow-y-auto">
    <TagSearchResults {controller} />
  </div>
</div>
