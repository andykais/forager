<script lang="ts">
  import type {BrowseController} from '../controller.ts'

  interface Props {
    controller: BrowseController
    params: BrowseController['runes']['queryparams']['DEFAULT']
  }
  let {params, controller, children}: Props = $props()
  const {queryparams} = controller.runes

</script>

<a
  href={queryparams.serialize(params)}
  onclick={async e => {
    if (e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    await queryparams.goto(params)
  }}
>
  {@render children?.()}
</a>
