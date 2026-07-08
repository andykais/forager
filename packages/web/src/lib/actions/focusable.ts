export function focusable(node: HTMLElement, focused: boolean) {
  const apply = (should_focus: boolean) => {
    if (should_focus) {
      node.focus()
    } else {
      node.blur()
    }
  }
  apply(focused)
  return {
    update(should_focus: boolean) {
      apply(should_focus)
    }
  }

}
