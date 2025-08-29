<script lang="ts">
  import * as parsers from '$lib/parsers.ts'
  import type { Forager } from '@forager/core'
  import type { BaseController } from "$lib/base_controller.ts";
  import Tag from '$lib/components/Tag.svelte'

  const debounce = <Args>(fn: (...args: Args[]) => void, pause: number) => {
    let timer: number | undefined
    return (...args: Args[]) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        fn(...args)
      }, pause)
    }
  }

  class TagSuggestions {
    state = $state<TagModel[]>([])
    #last_query_hash: string | undefined

    protected text_snippet_under_cursor() {
      const space_after_cursor_index = search_string.indexOf(' ', input_state.text_position)
      const space_before_cursor_index = search_string.lastIndexOf(' ', input_state.text_position)
      return {
        start: space_before_cursor_index,
        end: space_after_cursor_index,
      }
    }

    protected refresh_internal = async () => {
      const { text_position} = input_state

      let tag_match = search_string

      const text_snippet_position = this.text_snippet_under_cursor()
      if (text_snippet_position.end !== -1) {
        tag_match = tag_match.substring(0, text_snippet_position.end)
      }
      if (text_snippet_position.start !== -1) {
        tag_match = tag_match.substring(text_snippet_position.start + 1)
      }
      const current_query_hash = JSON.stringify(tag_match)
      if (this.#last_query_hash === current_query_hash) {
        return
      }
      this.#last_query_hash = current_query_hash

      // TODO only do this when the query has changed. Currently any time we focus in/out of the browser tab, it will re-search
      const search_options = {query:{tag_match}, sort_by}
      if (contextual_query) {
        search_options.contextual_query = contextual_query
      }
      const tags = await controller.client.forager.tag.search(search_options)
      input_state.suggestion_buttons = Array(tags.results.length).fill(null)
      this.state = tags.results
    }

    apply_suggestion(tag: TagModel) {
      const text_snippet_position = this.text_snippet_under_cursor()
      const tag_str = parsers.Tag.encode(tag)
      let updated_search_string  = ''
      if (text_snippet_position.start !== -1) {
        updated_search_string += search_string.substring(0, text_snippet_position.start)
      }
      updated_search_string += ` ${tag_str} `
      if (text_snippet_position.end !== -1) {
        updated_search_string += search_string.substring(text_snippet_position.end)
      }
      search_string = updated_search_string.trim()
      input_state.show_suggestions = false
      this.clear()
      input_state.just_populated_suggestions = true
      input_element.focus()
    }

    clear() {
      this.state = []
    }

    refresh = debounce(this.refresh_internal, 50)
  }


  type TagModel = Awaited<ReturnType<Forager['tag']['search']>>['results'][0]

  let {
    controller,
    kind,
    sort_by = 'media_reference_count',
    search_string = $bindable(),
    placeholder = 'genre:adventure...',
    input_classes = 'w-full rounded-lg py-0.5 px-3 text-slate-100 bg-gray-800',
    allow_multiple_tags = false,
    contextual_query,
  }: {
    sort_by?: 'updated_at' | 'media_reference_count'
    controller: BaseController
    search_string: string
    kind: 'search' | 'details'
    placeholder?: string
    input_classes?: string
    allow_multiple_tags: boolean
    // NOTE contextual_query works, but it is too slow on large tag/media_reference databases, so we need to rethink this
    contextual_query?: {}
  } = $props()

  let root_element: HTMLDivElement
  let input_element: HTMLInputElement
  let suggestions_element: HTMLUListElement | null = $state(null)

  let input_state = $state({
    lost_focus: false,
    show_suggestions: false,
    // used when we want to grab the focus on the input element and _dont_ want to immediately show suggestions again
    just_populated_suggestions: false,
    text_position: 0,
    current_hover_selection_index: -1,

    suggestion_buttons: [],
  })

  const tag_suggestions = new TagSuggestions()

  controller.keybinds.component_listen({
    Search: e => {
      if (kind === 'search') {
        e.detail.data.keyboard_event.preventDefault()
        input_element.focus()
      }
    },
    AddTag: e => {
      if (kind === 'details') {
        e.detail.data.keyboard_event.preventDefault()
        input_element.focus()
      }
    },
    NextTagSuggestion: e => {
      if (controller.runes.focus.focused({component: 'TagAutoCompleteInput', focus: kind})) {
        const length = tag_suggestions.state.length
        const index = input_state.current_hover_selection_index
        input_state.current_hover_selection_index = (index + 1) % length
        input_state.suggestion_buttons[input_state.current_hover_selection_index].focus()
      }
    },
    PrevTagSuggestion: e => {
      if (controller.runes.focus.focused({component: 'TagAutoCompleteInput', focus: kind})) {
        const length = tag_suggestions.state.length
        const index = input_state.current_hover_selection_index
        input_state.current_hover_selection_index = (index - 1 + length) % length
        input_state.suggestion_buttons[input_state.current_hover_selection_index].focus()
      }
    },
    Escape: e => {
      if (input_state.show_suggestions || document.activeElement === input_element) {
        input_state.show_suggestions = false
        input_element.blur()
      }
    }
  })

</script>

<style>
  .floating-suggestions {
    margin: 0 0.25rem;
    border-bottom-right-radius: 0.25rem;
    border-bottom-left-radius: 0.25rem;
  }

  .floating-suggestion-item {
    transition: background-color 0.25s cubic-bezier(.19,1,.22,1);
  }
  .floating-suggestion-item:last-child {
    border-radius: inherit;
  }
</style>

<div class="grid grid-rows-1 p-0" bind:this={root_element}>
  <input
    class={input_classes}
    type="text"
    name="search_bar"
    placeholder={placeholder}
    autocomplete="off"
    bind:this={input_element}
    list="taglist"
    onselectionchange={async e => {
      input_state.text_position = e.target.selectionStart
      input_state.lost_focus = false
      tag_suggestions.refresh()
      // await get_tag_suggestions_debounced(e.target.value, e.target.selectionStart)
    }}
    oninput={async e => {
      input_state.show_suggestions = true
      input_state.lost_focus = false
      search_string = e.target.value
      tag_suggestions.refresh()
    }}
    onfocusin={async e => {
      controller.runes.focus.stack({component: 'TagAutoCompleteInput', focus: kind})

      // we got here from a manual input_element.focus() call, so we should ignore setting suggestions this time
      if (input_state.just_populated_suggestions) {
        input_state.just_populated_suggestions = false
        return
      }
      if (input_state.lost_focus) {
        return
      }
      input_state.show_suggestions = true
      tag_suggestions.refresh()
    }}
    onfocusout={(e: FocusEvent) => {
      if (suggestions_element && suggestions_element.contains(e.relatedTarget)) {
      } else {
        input_state.show_suggestions = false
      }
      controller.runes.focus.pop('TagAutoCompleteInput', kind)
      input_state.lost_focus = true
    }}
    value={search_string}
  >
  <div class="relative w-full">
    <div class="absolute w-full z-10 text-slate-300">
      {#if input_state.show_suggestions}
      <ul class="bg-slate-700 floating-suggestions border-r-1 border-l-1 border-b-1 border-slate-500" bind:this={suggestions_element}>
        {#each tag_suggestions.state as tag, tag_index (tag.id)}
          <li
            class="hover:bg-slate-500 floating-suggestion-item">
            <button
              type="button"
              bind:this={input_state.suggestion_buttons[tag_index]}
              class={[
                "px-1 w-full text-left focus:bg-gray-400 outline-none",
                // input_state.current_hover_selection_index === tag_index && "bg-slate-500"
              ]}
              tabindex={0}
              onfocusout={e => {
                //controller.runes.focus.pop({component: 'TagAutoCompleteInput', focus: 'tag:suggestion:${tag.id}'})
              }}
              onfocusin={e => {
                //controller.runes.focus.stack({component: 'TagAutoCompleteInput', focus: 'tag:suggestion:${tag.id}'})
              }}
              onclick={e => {
                tag_suggestions.apply_suggestion(tag)
              }}>
              <Tag {tag} transparent />
            </button>
          </li>
        {/each}
      </ul>
      {/if}
    </div>
  </div>
</div>
