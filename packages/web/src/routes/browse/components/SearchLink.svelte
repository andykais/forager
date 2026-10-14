<script lang="ts">
  import type {BrowseController} from '../controller.ts'
  import type { SearchParams } from '../runes/queryparams.svelte.ts'
  import type { SvelteHTMLElements, ClassValue } from 'svelte/elements';
  import * as contexts from '$lib/contexts/index.ts'

  interface Props {
    params: SearchParams
    class?: ClassValue
    title?: string
    children: SvelteHTMLElements['div']['children']
  }
  let {params, children, ...props}: Props = $props()
  const {queryparams} = contexts.controller.get<BrowseController>().runes
</script>

<a
  class={props.class}
  title={props.title}
  href={queryparams.serialize(params)}
  onclick={async e => {
    if (e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    await queryparams.goto(params)
  }}
>
  {@render children?.()}
</a>
