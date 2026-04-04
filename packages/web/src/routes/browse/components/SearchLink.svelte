<script lang="ts">
  import type {BrowseController} from '../controller.ts'
  import type { SvelteHTMLElements, ClassValue } from 'svelte/elements';

  interface Props {
    controller: BrowseController
    params: Partial<BrowseController['runes']['queryparams']['DEFAULTS']>
    class?: ClassValue
    title?: string
    children: SvelteHTMLElements['div']['children']
  }
  let {params, controller, children, ...props}: Props = $props()
  const {queryparams} = controller.runes

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
