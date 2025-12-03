<script lang="ts">
  import type {SeriesController} from '../controller.ts'

  interface Props {
    controller: SeriesController
    params: SeriesController['runes']['queryparams']['DEFAULTS']
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
