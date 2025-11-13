export function scrollable(node: HTMLElement) {
  let is_visible = false
  const observer = new IntersectionObserver((entries) => {
    is_visible = entries[0].isIntersecting
  }, {threshold: 1.0})
  observer.observe(node)
  return {
    update(focused: boolean) {
      if (focused && !is_visible) {
        node.scrollIntoView({
          behavior: 'instant',
          block: 'end',
        })
      }
    }
  }

}
