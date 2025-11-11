export function scrollable(node: HTMLElement) {
  return {
    update(focused: boolean) {
      if (focused) {
        console.log('scrolling')
        node.scrollIntoView({
          behavior: 'instant',
          block: 'end',
        })
      }
    }
  }

}
