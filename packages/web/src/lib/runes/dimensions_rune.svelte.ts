export function create_dimensional_rune() {
  const heights = $state({
    screen: 0,
    header: 0,
    media_list: 0,
    footer: 0,
  })

  $effect(() => {
    // 5 here fixes an issue with heights being too long causing a scrollbar to appear.
    heights.media_list = heights.screen - heights.header - heights.footer - 5
  })

  return {
    get heights() {
      return heights
    },
  }
}

