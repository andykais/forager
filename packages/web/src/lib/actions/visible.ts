/** invokes `on_visible` the first time the node scrolls into (or near) the viewport */
export function visible(node: HTMLElement, on_visible: () => void) {
  let callback = on_visible
  const observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect()
      callback()
    }
  }, {rootMargin: '200px'})
  observer.observe(node)

  return {
    update(on_visible: () => void) {
      callback = on_visible
    },
    destroy() {
      observer.disconnect()
    },
  }
}
