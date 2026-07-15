<script lang="ts">
  import type {BrowseController} from '../controller.ts'
  import type { SvelteHTMLElements, ClassValue } from 'svelte/elements';
  import { get_controller } from '$lib/contexts/controller.ts'

  interface Props {
    params: Partial<BrowseController['runes']['queryparams']['DEFAULTS']>
    class?: ClassValue
    title?: string
    children: SvelteHTMLElements['div']['children']
  }
  let {params, children, ...props}: Props = $props()
  const {queryparams} = get_controller<BrowseController>().runes
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
