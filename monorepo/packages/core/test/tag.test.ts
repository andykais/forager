import { test } from 'forager-test'
import { Forager } from '~/mod.ts'


test('tag actions', async (ctx) => {
  let forager = new Forager(ctx.get_test_config())
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
  let doodle = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {}, [])

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
        {group: '', name: 'wallpaper', media_reference_count: 2},
        {group: 'genre', name: 'cartoon'},
        {group: 'colors', name: 'black'},
        {group: '', name: 'generated'},
        {group: 'genre', name: 'procedural_generation'},
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

  await ctx.subtest(`tag auto cleanup`, async () => {
    const assert_tags_before = {
      total: 5,
      results: [
        {group: '', name: 'wallpaper', media_reference_count: 2},
        {group: 'genre', name: 'cartoon'},
        {group: 'colors', name: 'black'},
        {group: '', name: 'generated'},
        {group: 'genre', name: 'procedural_generation'},
      ]
    }
    ctx.assert.tag_search_result(forager.tag.search(), assert_tags_before)

    // lets add a new tag
    doodle = forager.media.update(doodle.media_reference.id, {}, {add: ['foobar']})
    ctx.assert.list_partial(doodle.tags, [
      {name: 'foobar'}
    ])

    // observe the new tag
    const assert_tags_after = {
      total: 6,
      results: [
        {group: '', name: 'wallpaper', media_reference_count: 2},
        {group: '', name: 'foobar'},
        {group: 'genre', name: 'cartoon'},
        {group: 'colors', name: 'black'},
        {group: '', name: 'generated'},
        {group: 'genre', name: 'procedural_generation'},
      ]
    }
    ctx.assert.tag_search_result(forager.tag.search(), assert_tags_after)

    // remove the tag
    doodle = forager.media.update(doodle.media_reference.id, {}, {replace: []})
    ctx.assert.list_partial(doodle.tags, [])
    // now observe that the tag doesnt exist in forager
    ctx.assert.tag_search_result(forager.tag.search(), assert_tags_before)


    // now (jankily) update the config to not auto clean up the tag
    forager.close()
    const config = ctx.get_test_config()
    config.tags = {auto_cleanup: false}
    forager = new Forager(config)
    forager.init()

    doodle = forager.media.update(doodle.media_reference.id, {}, {add: ['foobar']})
    ctx.assert.list_partial(doodle.tags, [
      {name: 'foobar'}
    ])
    ctx.assert.tag_search_result(forager.tag.search(), assert_tags_after)
    doodle = forager.media.update(doodle.media_reference.id, {}, {replace: []})
    ctx.assert.list_partial(doodle.tags, [])
    // now observe that the tag _does_ exist
    ctx.assert.tag_search_result(forager.tag.search(), {
      total: 6,
      results: [
        {group: '', name: 'wallpaper', media_reference_count: 2},
        {group: 'genre', name: 'cartoon'},
        {group: 'colors', name: 'black'},
        {group: '', name: 'generated'},
        {group: 'genre', name: 'procedural_generation'},
        {group: '', name: 'foobar', media_reference_count: 0},
      ]
    })
  })

  await ctx.subtest(`tag sort`, async () => {
    // default sort is by 'media_reference_count'
    ctx.assert.tag_search_result(forager.tag.search({sort_by: 'media_reference_count'}), {
      total: 6,
      results: [
        {group: '', name: 'wallpaper', media_reference_count: 2},
        {group: 'genre', name: 'cartoon'},
        {group: 'colors', name: 'black'},
        {group: '', name: 'generated'},
        {group: 'genre', name: 'procedural_generation'},
        {group: '', name: 'foobar', media_reference_count: 0},
      ]
    })

    // ensure the timestamp for cartoon happens later than the above actions
    await ctx.timeout(10)
    forager.media.update(doodle.media_reference.id, {}, {add: ['genre:cartoon']})

    ctx.assert.tag_search_result(forager.tag.search({sort_by: 'updated_at'}), {
      results: [
        {name: 'cartoon', media_reference_count: 2},
        {group: '', name: 'foobar', media_reference_count: 0},
        {name: 'wallpaper', media_reference_count: 2},
        {name: 'black', media_reference_count: 1},
        {name: 'generated', media_reference_count: 1},
        {name: 'procedural_generation', media_reference_count: 1},
      ]
    })
  })
  forager.close()
})


test('tag contextual search', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  await forager.media.create(ctx.resources.media_files['koch.tif'], {}, ['procedural_generation', 'mathmatical', 'wallpaper'])
  await forager.media.create(ctx.resources.media_files["ed-edd-eddy.png"], {}, ['genre:cartoon', 'wallpaper'])
  await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {}, ['animal:cat'])

  ctx.assert.tag_search_result(forager.tag.search(), {
    total: 5,
    results: [
      {name: 'wallpaper'},
      {name: 'cat', group: 'animal'},
      {name: 'cartoon', group: 'genre'},
      {name: 'mathmatical'},
      {name: 'procedural_generation'},
    ]
  })


  const all_tags_related_to_wallpaper = forager.tag.search({
    contextual_query: {
      tags: ['wallpaper']
    }
  })

  // all our tags except animal:cat can be found under media with the tag "wallpaper"
  ctx.assert.tag_search_result(all_tags_related_to_wallpaper, {
    results: [
      {name: 'wallpaper'},
      {name: 'cartoon', group: 'genre'},
      {name: 'mathmatical'},
      {name: 'procedural_generation'},
    ]
  })
})
