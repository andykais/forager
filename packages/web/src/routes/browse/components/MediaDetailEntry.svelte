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
    hide_if_null?: boolean
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

  let display_inline = ['Views', 'Stars'].includes(props.label)
  console.log({label:props.label, display_inline})
</script>

{#if !(props.hide_if_null && props.content === null)}
  <div class={[
    "py-1.5",
    display_inline ? "grid grid-cols-[1fr_auto]" : ''
  ]}>
        <label class="text-green-50" for="{props.label}"><span>{props.label}</span></label>
        <div>
          {#if props.editable}
            <input
              class="bg-slate-400 w-full rounded-sm px-1 text-sm"
              type={props.type ?? "text"}
              value={value}
              >
          {:else}
            <span
              class="bg-slate-400 w-full inline rounded-sm px-1 text-sm text-nowrap select-all py-0.5"
              >
              {value}
              </span>
          {/if}
        </div>
  </div>
{/if}
