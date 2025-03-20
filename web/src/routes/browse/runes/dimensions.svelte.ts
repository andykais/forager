export function create_dimensional_rune() {
  let heights = $state({
    screen: 0,
    header: 0,
    media_list: 0,
    footer: 0,
  })

  $effect(() => {
    // 2 in here is just to fix an issue with heights being tool long causing a scrollbar to appear. It may have to do with borders or shadows
    heights.media_list = heights.screen - heights.header - heights.footer - 2
  })

  return {
    get heights() {
      return heights
    }
  }
}
