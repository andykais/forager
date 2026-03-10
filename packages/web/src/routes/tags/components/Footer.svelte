<script lang="ts">
  import type { TagsController } from '../controller.ts'

  let { controller }: { controller: TagsController } = $props()
  const { queryparams } = controller.runes

  function human_readable_number(n: number) {
    const number_string = n.toString()
    const number_groups: string[] = []
    let current_group: string = ''
    for (const digit of Array.from(number_string).reverse()) {
      current_group += digit
      if (current_group.length >= 3) {
        number_groups.push(current_group)
        current_group = ''
      }
    }
    if (current_group) {
      number_groups.push(current_group)
    }
    return Array.from(number_groups.join(',')).reverse().join('')
  }
</script>

<footer
  class="
  bg-gray-700 items-center px-2 py-1
  text-slate-900 border-t-slate-700 border-t-2"
>
  <div class="flex justify-end">
    <span>Total tags {human_readable_number(queryparams.total)}</span>
  </div>
</footer>
