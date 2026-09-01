<script lang="ts">
  import SearchLink from '$lib/components/browsable/SearchLink.svelte'
  import type { BrowsableController } from '$lib/base_controller.ts'
  import type { MediaGroupRune } from '$lib/runes/index.ts'

  interface Props {
    controller: BrowsableController
    result: MediaGroupRune
  }

  let { controller, result }: Props = $props()
  const { queryparams } = controller.runes
</script>

<SearchLink
  class="hover:text-green-500 hover:bg-gray-700 px-2 rounded-sm"
  title="Search within this group"
  {controller}
  params={queryparams.merge({
    mode: 'media',
    tags: `${queryparams.current.group_by ?? ''}:${result.group_metadata.value}`,
  })}
>{result.group_metadata.value}</SearchLink>
