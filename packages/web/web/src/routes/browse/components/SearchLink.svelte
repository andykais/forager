<script lang="ts">
  import type {BrowseController} from '../controller.ts'

  interface Props {
    controller: BrowseController
    params: BrowseController['runes']['queryparams']['DEFAULT']
    class: ClassValue
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
