<script lang="ts">
  import type { Forager } from '@forager/core'

  type Tag = ReturnType<Forager['tag']['search']>['results'][0]
  let props: {tag: Tag} = $props()

  const tag_identifier = props.tag.group === ''
    ? `${props.tag.name}`
    : `${props.tag.group}:${props.tag.name}`
</script>


<span class="flex">
  <span class="flex-grow">{tag_identifier}</span>
  <span>{props.tag.media_reference_count}</span>
</span>
