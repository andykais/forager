<script lang="ts">
  import type { Forager } from '@forager/core'
  import Icon from '$lib/components/Icon.svelte'
  import * as theme from '$lib/theme.ts'

  type Tag = ReturnType<Forager['tag']['search']>['results'][0]
  let props: {tag: Tag, transparent?: boolean; show_group?: boolean} = $props()

  const tag_identifier = props.tag.group === '' || props.show_group === false
    ? `${props.tag.name}`
    : `${props.tag.group}:${props.tag.name}`

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
  <span>{props.tag.media_reference_count}</span>
</span>
