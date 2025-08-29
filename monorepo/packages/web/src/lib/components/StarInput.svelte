<script lang="ts">
  let {
    star,
    value = $bindable<number>(),
    onclick,
  }: {
    star: number
    value: number
    onclick: () => void
  } = $props()
</script>

<button
  type="button"
  class={[
    "px-2",
    [value === star && "bg-gray-800"]
  ]}
  onclick={() => {
    value = value === star ? undefined : star
    onclick()
  }}>{star}</button>
