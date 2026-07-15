<script lang="ts">
  import TagSearchParams from './components/TagSearchParams.svelte'
  import TagSearchResults from './components/TagSearchResults.svelte'
  import Footer from './components/Footer.svelte'
  import { TagsController } from './controller.ts'
  import { set_controller } from '$lib/contexts/controller.ts'
  import Header from '$lib/components/Header.svelte'

	/** @type {import('./$types').PageProps} */
  let props = $props()
  set_controller(new TagsController(props.data.config))
</script>

<div class="h-dvh flex flex-col">
  <Header title="Tag Search">
    <TagSearchParams />
  </Header>
  <div class="flex-grow overflow-y-auto">
    <TagSearchResults />
  </div>
  <Footer />
</div>
