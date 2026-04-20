<script lang="ts">
  import type { BrowseController } from '../controller.ts'
  import * as icons from '$lib/icons/mod.ts'
  import * as theme from '$lib/theme.ts'
  import Icon from '$lib/components/Icon.svelte'
  import SearchLink from './SearchLink.svelte'

  interface StarsValue {
    type: 'stars'
    value: number
    max?: number
  }

  export interface InfoEntry {
    name: string
    icon: string
    title?: string
    stat?: unknown
    queryparams?: Partial<BrowseController['runes']['queryparams']['DEFAULTS']>
    value: string | number | StarsValue
    enabled: boolean
    order: number
  }
  interface Props {
    entries: InfoEntry[]
    controller: BrowseController
  }
  let props: Props = $props()
  let {controller} = props
  let entries = $derived(props.entries
    .filter(entry => entry.enabled)
    .sort((a, b) => a.order - b.order)
  )

  const icon_size = 14
  const icon_color = theme.colors.green[200]
  const star_filled_color = theme.colors.yellow?.[300] ?? theme.colors.green[200]
  const star_empty_color = theme.colors.gray[600]

  function is_stars(value: InfoEntry['value']): value is StarsValue {
    return typeof value === 'object' && value !== null && (value as StarsValue).type === 'stars'
  }
</script>


<table class="w-full">
  <tbody>
    {#each entries as entry, index}
<tr class={[
      "grid grid-cols-[auto_1fr_auto] gap-2 items-center px-3 py-1",
      index !== entries.length - 1 && "border-b-gray-500 border-b",
    ]}
      >
      <td>
        <Icon data={entry.icon} fill={icon_color} stroke="none" size={icon_size} title={entry.title} />
      </td>
      <td class="justify-self-start">
          {#if is_stars(entry.value)}
            {@const max = entry.value.max ?? 5}
            <span class="flex items-center gap-0.5" title={entry.title}>
              {#each Array(max) as _, i}
                <Icon
                  data={icons.Star}
                  fill={i < entry.value.value ? star_filled_color : star_empty_color}
                  stroke="none"
                  size={icon_size}
                />
              {/each}
            </span>
          {:else if entry.queryparams}
            <SearchLink
              class="hover:text-green-500 hover:bg-gray-800 bg-gray-700 px-2 rounded-sm"
              {controller} params={entry.queryparams}> {entry.value}
            </SearchLink>
          {:else}
            <span title={entry.title}>{entry.value}</span>
          {/if}
      </td>
      <td class="justify-self-end">{entry.stat ?? ''}</td>
    </tr>
    {/each}
  </tbody>
</table>
