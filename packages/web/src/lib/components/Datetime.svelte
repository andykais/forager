<script lang="ts">
  let { value, class: class_name }: { value: Date | string; class?: string } = $props()

  const date = $derived(new Date(value))
  const display = $derived(date.toLocaleDateString())
  const iso = $derived(date.toISOString())
</script>

<time datetime={iso} title={iso} class={class_name}>{display}</time>
