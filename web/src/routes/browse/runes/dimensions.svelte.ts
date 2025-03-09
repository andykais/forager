export function create_dimensional_rune() {
  let heights = $state({
    screen: 0,
    header: 0,
    media_list: 0,
    footer: 0,
  })

  $effect(() => {
    heights.media_list = heights.screen - heights.header - heights.footer
  })

  return {
    get heights() {
      return heights
    }
  }
}
