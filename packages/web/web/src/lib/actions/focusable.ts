export function focusable(node: HTMLElement) {
  return {
    update(focused: boolean) {
      if (focused) {
        node.focus()
      } else {
        node.blur()
      }
    }
  }

}
