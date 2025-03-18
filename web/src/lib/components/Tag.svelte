<script lang="ts">
  import type { Forager } from '@forager/core'
  import Icon from '$lib/components/Icon.svelte'
  import * as theme from '$lib/theme.ts'

  type Tag = ReturnType<Forager['tag']['search']>['results'][0]
  let props: {tag: Tag} = $props()

  const tag_identifier = props.tag.group === ''
    ? `${props.tag.name}`
    : `${props.tag.group}:${props.tag.name}`
</script>


<span class="w-full flex rounded-sm px-1" style="background-color: {props.tag.color}">
  <span class="flex-grow">{tag_identifier}</span>
  <span>{props.tag.media_reference_count}</span>
</span>
