<script lang="ts">
  import * as theme from '$lib/theme.ts'
  import { Star } from '$lib/icons/mod.ts'
  import Icon from '$lib/components/Icon.svelte'

  let {
    star,
    value = $bindable<number>(),
    onclick,
  }: {
    star: number
    value: number
    onclick: () => void
  } = $props()

  let icon_color = $derived.by(() => {
    if (value >= star) {
      // starred
      return theme.colors.gray[400]
    } else {
      // unstarred
      return theme.colors.gray[800]
    }
  })
</script>

<button
  type="button"
  class={[
  ]}
  onclick={() => {
    value = value === star ? undefined : star
    onclick()
  }}>
    <Icon class="hover:fill-gray-200" data={Star} size={20} fill={icon_color} stroke={"none"} />
</button>
