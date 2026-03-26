<script lang="ts">
  let {
    number,
    hide_zero = false,
  }: {
    number: number
    hide_zero?: boolean
  } = $props()

  let pretty_number = $derived.by(() => {
    const stringified = number.toString()

    let prettified = ''
    for (let i = 0; i < stringified.length; i ++) {
      prettified += stringified[i]
      const reverse_index = stringified.length - i - 1
      if (reverse_index !== 0 && reverse_index % 3 === 0) prettified += ','
    }

    return prettified
  })
</script>

{#if hide_zero && number === 0}
{''}
{:else}
{pretty_number}
{/if}
