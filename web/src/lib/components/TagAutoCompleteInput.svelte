<script lang="ts">
  import * as parsers from '$lib/parsers.ts'
  import type { Forager } from '@forager/core'
  import type { BaseController } from "$lib/base_controller.ts";
  import * as theme from '$lib/theme.ts'
  import Icon from '$lib/components/Icon.svelte'
  import Tag from '$lib/components/Tag.svelte'
  import { Filter } from '$lib/icons/mod.ts'

  const debounce = <Args>(fn: (...args: Args) => void, pause: number) => {
    let timer: number | undefined
    return (...args: Args) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        fn(...args)
      }, pause)
    }
  }


  type TagModel = Awaited<ReturnType<Forager['tag']['search']>>['results'][0]

  let {controller, search_string = $bindable()}: {controller: BaseController; search_string: string} = $props()

  let input_state = $state({
    show_suggestions: false,
    text_position: 0,
  })
  class TagSuggestions {
    state = $state<TagModel[]>([])

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

      const tags = await controller.client.forager.tag.search({query:{tag_match}})
      this.state = tags.results
    }

    apply_suggestion(tag: TagModel) {
      console.log('apply_suggestion')
      input_state.show_suggestions = false
      console.log('apply suggestion', this.state)
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
    }

    clear() {
      this.state = []
    }

    refresh = debounce(this.refresh_internal, 50)
  }
  const tag_suggestions = new TagSuggestions()

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

<div class="grid grid-rows-1 p-4 bg-gray-700">
  <input
    onselectionchange={async e => {
      console.log('onselectionchange')
      input_state.text_position = e.target.selectionStart
      await tag_suggestions.refresh()
      // await get_tag_suggestions_debounced(e.target.value, e.target.selectionStart)
    }}
    oninput={async e => {
      console.log('oninput')
      input_state.show_suggestions = true
      search_string = e.target.value
      await tag_suggestions.refresh()
    }}
    onfocusin={async e => {
      input_state.show_suggestions = true
      await tag_suggestions.refresh()
    }}
    onfocusout={e => {
      console.log('onfocusout')
      // TODO note this should be replaced with a global "focus" handler so we can be smarter here
      // the problem is that this focusout will get triggered before the onclick for the tag suggestion has a chance to fire
      // if we have a global focus though, we can say "if focus is not tag search OR tag suggestion, hide suggestions"
      // setTimeout(() => {
      //   input_state.show_suggestions = false
      // }, 100)
    }}
    value={search_string}
    class="basis-full rounded px-1"
    type="text"
    name="search_bar"
    placeholder="genre:adventure">
  <div class="relative w-full">
    <div class="absolute w-full">
      {#if input_state.show_suggestions}
      <ul class="bg-gray-200 floating-suggestions">
        {#each tag_suggestions.state as tag (tag.id)}
          <li
            class="px-1 hover:bg-gray-400 floating-suggestion-item">
            <button
              type="button"
              class="w-full text-left"
              onclick={e => {
                console.log('on click?')
                tag_suggestions.apply_suggestion(tag)
              }}>
              <Tag {tag} />
            </button>
          </li>
        {/each}
      </ul>
      {/if}
    </div>
    <!--
    -->
  </div>
</div>
