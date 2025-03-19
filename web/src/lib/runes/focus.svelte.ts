type FocusComponent =
  | 'BrowsePage'
  | 'TagAutoCompleteInput'

interface Focus {
  component: FocusComponent
  focus: string
}

interface FocusState {
  focus_stack: Focus[]
}

export const create_focuser = () => {
  let state = $state<FocusState>({focus_stack: []})
  return {
    stack(focus: Focus) {
      console.log('focus::stack', focus, Date.now())
      const focus_in_stack = state.focus_stack.findLastIndex(item => item.component == focus.component && item.focus === focus.focus)
      // ensure we dont double stack the same focus
      if(focus_in_stack !== -1) {
        state.focus_stack = state.focus_stack.slice(0, focus_in_stack + 1)
      } else {
        state.focus_stack.push(focus)
      }
    },

    pop(focus: Focus) {
      console.log('focus::pop', focus)
      const new_focus_stack: Focus[] = []
      for (const item of state.focus_stack) {
        if (item.component == focus.component && item.focus === focus.focus) {
          break
        }
        new_focus_stack.push(item)
      }

      state.focus_stack = new_focus_stack
    },

    get focus() {
      return state.focus_stack.at(-1)
    },

    focused(focus: Focus) {
      return state.focus_stack.some(f => f.component === focus.component && f.focus === focus.focus)
    }
  }
}
