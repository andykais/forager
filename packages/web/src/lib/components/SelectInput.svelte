<script lang="ts">
  interface SelectOption {
    label: string
    value: string
  }
  interface Props {
    label: string
    options: SelectOption
    value: string
    onchange: () => void | undefined
  }
  let {
    label,
    options,
    onchange,
    value = $bindable(),
  }: Props = $props()

</script>
<div class="flex gap-2 items-center">
  {#if label}
    <label class="text-nowrap" for="unread">{label}:</label>
  {/if}
  <select
    bind:value={value}
    onchange={e => {
      if (onchange) {
        onchange(e)
      }
    }}
  >
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
</div>
