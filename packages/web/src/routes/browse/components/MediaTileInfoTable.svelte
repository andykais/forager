<script lang="ts">
  import type { BrowseController } from '../controller.ts'
  import * as icons from '$lib/icons/mod.ts'
  import * as theme from '$lib/theme.ts'
  import Icon from '$lib/components/Icon.svelte'
  import SearchLink from './SearchLink.svelte'

  interface InfoEntry {
    name: string
    icon: string
    title?: string
    stat?: object
    queryparams?: string
    value: object
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
  const {queryparams, settings, media_selections, media_list} = controller.runes

  const icon_size = 14
  const icon_color = theme.colors.green[200]

  const row_colors = [
    theme.colors.gray[800],
    theme.colors.gray[700],
  ]
</script>


<table class="w-full">
  <tbody>
    {#each entries as entry, index}
<tr class={[
      "grid grid-cols-[auto_auto_auto] justify-between px-3 py-1",
      index !== entries.length - 1 && "border-b-gray-500 border-b",
    ]}
      >
      <!-- style={`background-color: ${row_colors[index % 2]}`} -->
      <td>
        <Icon data={entry.icon} fill={icon_color} stroke="none" size={icon_size} title={entry.title} />
      </td>
      <td>
          {#if entry.queryparams}
            <SearchLink
              class="hover:text-green-500 hover:bg-gray-800 bg-gray-700 px-2 rounded-sm"
              {controller} params={entry.queryparams}> {entry.value}
            </SearchLink>
          {:else}
            <span>{entry.value} </span>
          {/if}
      </td>
      <td>{entry.stat}</td>
    </tr>
    {/each}
  </tbody>
</table>
