<script lang="ts">
  import TagSearchParams from './components/TagSearchParams.svelte'
  import TagSearchResults from './components/TagSearchResults.svelte'
  import Footer from './components/Footer.svelte'
  import { TagsController } from './controller.ts'
  import Header from '$lib/components/Header.svelte'

  let props = $props()
  const controller = new TagsController(props.data.config)
</script>

<div class="h-dvh flex flex-col">
  <Header title="Tag Search">
    <TagSearchParams {controller} />
  </Header>
  <div class="flex-grow overflow-y-auto">
    <TagSearchResults {controller} />
  </div>
  <Footer {controller} />
</div>
