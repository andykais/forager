<script lang="ts">
  import Icon from '$lib/components/Icon.svelte'
  import * as theme from '$lib/theme.ts'
  import * as datetime from '@std/datetime'
  import { Copy } from '$lib/icons/mod.ts'
  import type { Json } from '@andykais/ts-rpc/adapters/sveltekit.ts'

  import { BrowseController } from '../controller.ts'
  let {controller, ...props}: {
    controller: BrowseController
    label: string
    content: string | number | Date | null | Json
    type?: "text" | "datetime-local"
    editable?: boolean
  } = $props()

  let value = $derived.by(() => {
    if (props.content === null) return null

    if (props.type === 'datetime-local') {
      return datetime.format(new Date(props.content as string), 'yyyy-MM-ddTHH:mm')
    }

    return props.content
  })

  let input_type = $derived.by(() => {
    switch(typeof props.content) {
      case 'string': {
        return "text"
      }
    }

    if (props.content instanceof Date) {
      return "date"
    }
    
    if (props.content === null) {
      return "text"
    }

    throw new Error(`Unexpected media detail content ${props.content}`)
  })
</script>

<div class="py-2">
  <div class="grid grid-cols-[auto_1fr] justify-items-end items-center">
    <label class="text-green-50" for="{props.label}"><span>{props.label}</span></label>
    <button class="hover:cursor-pointer" title="Copy to clipboard">
      <Icon class="hover:stroke-green-300" data={Copy} fill={"none"} size="18px" stroke={theme.colors.green['50']} />
    </button>
  </div>
  <input
    class="bg-slate-400 w-full rounded-sm px-1 text-sm"
    type={props.type ?? "text"}
    value={value}
    disabled={!props.editable}>
</div>
