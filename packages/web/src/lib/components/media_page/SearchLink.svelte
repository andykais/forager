<script lang="ts">
  import type {MediaPageController} from '$lib/media_page_controller.ts'
  import type { Snippet } from 'svelte'

  interface Props {
    controller: MediaPageController
    params: Record<string, any>
    class?: string
    children?: Snippet
  }
  let {params, controller, children, ...props}: Props = $props()
  const {queryparams} = controller.runes
</script>

<a
  class={props.class}
  href={queryparams.serialize(params)}
  onclick={async e => {
    if (e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    await queryparams.goto(params)
  }}
>
  {@render children?.()}
</a>
