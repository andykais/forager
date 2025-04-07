import { test } from 'forager-test'
import { Forager } from '~/mod.ts'


test('tag actions', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const art = await forager.media.create(ctx.resources.media_files['koch.tif'], {}, [
    // this one should transform capitals and spaces for us
    { group: 'genre', name: 'Procedural Generation' },
    // this one is here so we can ensure different tags can exist for the same tag group id
    { group: '', name: 'generated' },
    // this is a different tag group
    { group: 'colors', name: 'black' },
    // this is a shorthand tag declaration
    'wallpaper',
  ])

  const screenshot = await forager.media.create(ctx.resources.media_files["ed-edd-eddy.png"], {}, [
    // shorthand with a group
    'genre:cartoon',
    // share a tag between two files
    'wallpaper'
  ])
  const doodle = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {}, [])

  await ctx.subtest('validate tag parsing', () => {
    ctx.assert.list_partial(art.tags, [
      {group: '', name: 'wallpaper', media_reference_count: 1, color: 'hsl(0, 70%, 55%)'},
      {group: 'colors', name: 'black', media_reference_count: 1, color: 'hsl(299, 70%, 55%)'},
      {group: '', name: 'generated', media_reference_count: 1, color: 'hsl(0, 70%, 55%)'},
      {group: 'genre', name: 'procedural_generation', media_reference_count: 1, color: 'hsl(15, 70%, 55%)'},
    ])
    ctx.assert.list_partial(screenshot.tags, [
      // tags with more media references are ordered first
      {group: '', name: 'wallpaper', media_reference_count: 2},
      {group: 'genre', name: 'cartoon', media_reference_count: 1},
    ])
    ctx.assert.list_partial(doodle.tags, [
    ])
  })

  await ctx.subtest('tag search', () => {
    ctx.assert.tag_search_result(forager.tag.search(), {
      total: 5,
      results: [
        {group: 'genre', name: 'procedural_generation'},
        {group: '', name: 'generated'},
        {group: 'colors', name: 'black'},
        {group: '', name: 'wallpaper', media_reference_count: 2},
        {group: 'genre', name: 'cartoon'},
      ]
    })

    ctx.assert.tag_search_result(forager.tag.search({
      query: {tag_match: 'gen'}
    }), {
      total: 1,
      results: [
        {group: '', name: 'generated'},
      ]
    })

    ctx.assert.tag_search_result(forager.tag.search({
      query: {tag_match: '*gen*'}
    }), {
      total: 2,
      results: [
        {group: '', name: 'generated'},
        {group: 'genre', name: 'procedural_generation'},
      ]
    })

    ctx.assert.tag_search_result(forager.tag.search({
      query: {tag_match: '*gen*'}
    }), {
      total: 2,
      results: [
        {group: '', name: 'generated'},
        {group: 'genre', name: 'procedural_generation'},
      ]
    })

    ctx.assert.tag_search_result(forager.tag.search({
      query: {tag_match: ':*gen*'}
    }), {
      total: 1,
      results: [
        {group: '', name: 'generated'},
      ]
    })

    ctx.assert.tag_search_result(forager.tag.search({
      query: {tag_match: '*r*:'}
    }), {
      total: 3,
      results: [
        {group: 'genre', name: 'cartoon'},
        {group: 'colors', name: 'black'},
        {group: 'genre', name: 'procedural_generation'},
      ]
    })
  })
})
