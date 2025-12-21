<script lang="ts">
  import type { MediaListPageController } from '$lib/pages/media_list/controller.ts'

  interface Props {
    controller: MediaListPageController
    params: Record<string, unknown>
    class?: string
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
