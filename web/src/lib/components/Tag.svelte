<script lang="ts">
  import type { Forager } from '@forager/core'
  import * as parsers from '$lib/parsers.ts'

  type Tag = ReturnType<Forager['tag']['search']>['results'][0]
  let props: {tag: Tag, transparent?: boolean; show_group?: boolean} = $props()

  const tag_identifier = props.tag.group === '' || props.show_group === false
    ? `${props.tag.name}`
    : parsers.Tag.encode(props.tag)

  let color_style = $derived.by(() => {
    if (props.transparent) {
      return `color: ${props.tag.color}`
    } else {
      return `background-color: ${props.tag.color}`
    }
  })
</script>


<span class="w-full flex rounded-sm px-1" style={color_style} title="{props.tag.group}:{props.tag.name}">
  <span class="flex-grow">{tag_identifier}</span>
  <span class="text-gray-600">{props.tag.media_reference_count}</span>
</span>
