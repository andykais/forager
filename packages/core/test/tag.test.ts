import { test } from 'forager-test'
import { Forager, errors } from '~/mod.ts'


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
    // now observe that the tag _does_ exist when we include zero-reference-count tags
    ctx.assert.tag_search_result(forager.tag.search({include_zero_reference_count: true}), {
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
    // default tag.search hides zero-reference-count tags
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
  })

  await ctx.subtest(`tag sort`, async () => {
    // default sort is by 'media_reference_count', zero-count tags hidden by default
    ctx.assert.tag_search_result(forager.tag.search({sort_by: 'media_reference_count'}), {
      total: 5,
      results: [
        {group: '', name: 'wallpaper', media_reference_count: 2},
        {group: 'genre', name: 'cartoon'},
        {group: 'colors', name: 'black'},
        {group: '', name: 'generated'},
        {group: 'genre', name: 'procedural_generation'},
      ]
    })

    // with include_zero_reference_count, foobar shows up
    ctx.assert.tag_search_result(forager.tag.search({sort_by: 'media_reference_count', include_zero_reference_count: true}), {
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

    ctx.assert.tag_search_result(forager.tag.search({sort_by: 'updated_at', include_zero_reference_count: true}), {
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

  await ctx.subtest(`updates w/out tag changes`, async () => {
    ctx.assert.equals(doodle.media_reference.stars, 0)

    let doodle_media = forager.media.get({media_reference_id: doodle.media_reference.id})
    ctx.assert.equals(doodle_media.tags.length, 1)
    ctx.assert.equals(doodle_media.tags[0].name, 'cartoon')
    doodle_media = forager.media.update(doodle.media_reference.id, {stars: 1})

    ctx.assert.equals(doodle_media.media_reference.stars, 1)
    // ensure tags do not change
    ctx.assert.equals(doodle_media.tags.length, 1)
    ctx.assert.equals(doodle_media.tags[0].name, 'cartoon')
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


test('tag alias', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const media_generated = await forager.media.create(ctx.resources.media_files['koch.tif'], {}, ['animal:cat', 'wallpaper'])
  const media_cartoon = await forager.media.create(ctx.resources.media_files['ed-edd-eddy.png'], {}, ['animal:cat', 'animal:dog'])
  const media_doodle = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {}, ['animal:kitty'])

  await ctx.subtest('create alias migrates media_reference_tag rows', () => {
    const result = forager.tag.alias_create({
      alias_tag: 'animal:kitty',
      alias_for_tag: 'animal:cat',
    })

    ctx.assert.object_match(result.rule, {
      alias_tag_slug: 'animal:kitty',
      alias_for_tag_slug: 'animal:cat',
    })
    ctx.assert.object_match(result.alias!.tag, { name: 'kitty', group: 'animal', media_reference_count: 0 })
    ctx.assert.object_match(result.alias_for.tag, { name: 'cat', group: 'animal', media_reference_count: 3 })

    ctx.assert.list_partial(forager.media.get({media_reference_id: media_generated.media_reference.id }).tags, [
      { slug: 'animal:cat' },
      { slug: 'wallpaper' },
    ])
    ctx.assert.list_partial(forager.media.get({media_reference_id: media_cartoon.media_reference.id }).tags, [
      { slug: 'animal:cat' },
      { slug: 'animal:dog' },
    ])
    ctx.assert.list_partial(forager.media.get({media_reference_id: media_doodle.media_reference.id }).tags, [
      { slug: 'animal:cat' },
    ])
  })

  await ctx.subtest('get shows alias relationships', () => {
    const kitty_detail = forager.tag.get({ slug: 'animal:kitty' })
    ctx.assert.object_match(kitty_detail.alias_for!, { name: 'cat', group: 'animal' })
    ctx.assert.list_partial(kitty_detail.aliases, [])

    const cat_detail = forager.tag.get({ slug: 'animal:cat' })
    ctx.assert.equals(cat_detail.alias_for, null)
    ctx.assert.list_partial(cat_detail.aliases, [
      { slug: 'animal:kitty', name: 'kitty' },
    ])
  })

  await ctx.subtest('cannot create duplicate alias', () => {
    ctx.assert.throws(
      () => forager.tag.alias_create({ alias_tag: 'animal:kitty', alias_for_tag: 'animal:cat' }),
      errors.BadInputError,
    )
  })

  await ctx.subtest('cannot alias a tag to itself', () => {
    ctx.assert.throws(
      () => forager.tag.alias_create({ alias_tag: 'animal:cat', alias_for_tag: 'animal:cat' }),
      errors.BadInputError,
    )
  })

  await ctx.subtest('cannot alias to a tag that is itself an alias', () => {
    ctx.assert.throws(
      () => forager.tag.alias_create({ alias_tag: 'wallpaper', alias_for_tag: 'animal:kitty' }),
      errors.BadInputError,
    )
  })

  await ctx.subtest('delete alias', () => {
    const wallpaper_result = forager.tag.alias_create({ alias_tag: 'wallpaper', alias_for_tag: 'animal:cat' })
    ctx.assert.list_partial(forager.tag.get({ slug: 'animal:cat' }).aliases, [
      { slug: 'animal:kitty' },
      { slug: 'wallpaper' },
    ])

    forager.tag.alias_delete({ id: wallpaper_result.rule.id })

    ctx.assert.list_partial(forager.tag.get({ slug: 'animal:cat' }).aliases, [
      { slug: 'animal:kitty' },
    ])
  })

  await ctx.subtest('alias migration when source and target share a media reference', () => {
    // ed-edd-eddy has both animal:cat and animal:dog. Aliasing dog->cat should be
    // a no-op for that media reference (get_or_create finds the existing row)
    const dog_before = forager.tag.get({ slug: 'animal:dog' })
    ctx.assert.equals(dog_before.tag.media_reference_count, 1)

    const result = forager.tag.alias_create({ alias_tag: 'animal:dog', alias_for_tag: 'animal:cat' })
    ctx.assert.equals(result.alias!.tag.media_reference_count, 0)
    // cat stays at 3 because ed-edd-eddy already had animal:cat
    ctx.assert.equals(result.alias_for.tag.media_reference_count, 3)
  })

  await ctx.subtest('alias tag that has a parent relationship', () => {
    // create a fresh parent rule on a tag, then alias it away
    forager.tag.parent_create({ child_tag: 'animal:kitty', parent_tag: 'animal:cat' })
    const kitty = forager.tag.get({ slug: 'animal:kitty' })
    ctx.assert.list_partial(kitty.parents, [{ slug: 'animal:cat' }])
    // kitty is already an alias of cat and has 0 media refs, so the alias+parent overlap is benign
    ctx.assert.equals(kitty.tag.media_reference_count, 0)
  })

  await ctx.subtest('alias when source tag does not exist yet', () => {
    const result = forager.tag.alias_create({ alias_tag: 'animal:kitten', alias_for_tag: 'animal:cat' })
    ctx.assert.object_match(result.rule, {
      alias_tag_slug: 'animal:kitten',
      alias_for_tag_slug: 'animal:cat',
    })
    // source tag has no DB record, so alias detail is null
    ctx.assert.equals(result.alias, null)
    ctx.assert.object_match(result.alias_for.tag, { name: 'cat' })

    // animal:kitten has no DB record, so it won't appear in the resolved aliases list
    const cat = forager.tag.get({ slug: 'animal:cat' })
    ctx.assert.list_partial(cat.aliases, [
      { slug: 'animal:kitty' },
      { slug: 'animal:dog' },
    ])
  })

  await ctx.subtest('auto cleanup preserves tags referenced by alias rules', async () => {
    // kitty has 0 media_reference_count after alias migration, but it's referenced
    // by an alias rule, so delete_unreferenced should NOT remove it.
    const kitty_before = forager.tag.get({ slug: 'animal:kitty' })
    ctx.assert.equals(kitty_before.tag.media_reference_count, 0)

    // trigger auto cleanup by adding and removing a tag on some media
    const media = forager.media.search()
    const media_ref_id = media.results[0].media_reference.id
    forager.media.update(media_ref_id, {}, { add: ['temp_tag'] })
    forager.media.update(media_ref_id, {}, { remove: ['temp_tag'] })

    // kitty tag record should survive (referenced by alias rule)
    const kitty_after = forager.tag.get({ slug: 'animal:kitty' })
    ctx.assert.equals(kitty_after.tag.media_reference_count, 0)

    // cat still lists kitty as a resolved alias
    const cat = forager.tag.get({ slug: 'animal:cat' })
    ctx.assert.list_partial(cat.aliases, [
      { slug: 'animal:kitty' },
      { slug: 'animal:dog' },
    ])

    // temp_tag (no rules) was cleaned up
    ctx.assert.throws(
      () => forager.tag.get({ slug: 'temp_tag' }),
      errors.NotFoundError,
    )
  })
})


test('tag parent', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const media_generated = await forager.media.create(ctx.resources.media_files['koch.tif'], {}, ['genre:fractal', 'genre:animation'])
  const media_cartoon = await forager.media.create(ctx.resources.media_files['ed-edd-eddy.png'], {}, ['genre:cartoon'])
  const media_doodle = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {}, ['genre:cartoon', 'genre:fractal'])

  await ctx.subtest('create parent propagates to existing media', () => {
    const result = forager.tag.parent_create({
      child_tag: 'genre:cartoon',
      parent_tag: 'genre:animation',
    })

    ctx.assert.object_match(result.rule, {
      child_tag_slug: 'genre:cartoon',
      parent_tag_slug: 'genre:animation',
    })
    ctx.assert.object_match(result.child!.tag, { name: 'cartoon', media_reference_count: 2 })
    // animation: koch.tif (already had it) + ed-edd-eddy + cat_doodle = 3
    ctx.assert.object_match(result.parent.tag, { name: 'animation', media_reference_count: 3 })

    ctx.assert.list_partial(forager.media.get({media_reference_id: media_generated.media_reference.id}).tags, [
      { slug: 'genre:animation' },
      { slug: 'genre:fractal' },
    ])

    ctx.assert.list_partial(forager.media.get({media_reference_id: media_cartoon.media_reference.id}).tags, [
      { slug: 'genre:animation' },
      { slug: 'genre:cartoon' },
    ])

    ctx.assert.list_partial(forager.media.get({media_reference_id: media_doodle.media_reference.id}).tags, [
      { slug: 'genre:animation' },
      { slug: 'genre:cartoon' },
      { slug: 'genre:fractal' },
    ], (a, b) => a.slug.localeCompare(b.slug))
  })

  await ctx.subtest('get shows parent/child relationships', () => {
    const cartoon_detail = forager.tag.get({ slug: 'genre:cartoon' })
    ctx.assert.list_partial(cartoon_detail.parents, [
      { slug: 'genre:animation', name: 'animation' },
    ])
    ctx.assert.list_partial(cartoon_detail.children, [])

    const animation_detail = forager.tag.get({ slug: 'genre:animation' })
    ctx.assert.list_partial(animation_detail.children, [
      { slug: 'genre:cartoon', name: 'cartoon' },
    ])
    ctx.assert.list_partial(animation_detail.parents, [])
  })

  await ctx.subtest('cannot parent a tag to itself', () => {
    ctx.assert.throws(
      () => forager.tag.parent_create({ child_tag: 'genre:cartoon', parent_tag: 'genre:cartoon' }),
      errors.BadInputError,
    )
  })

  await ctx.subtest('circular parent detection', () => {
    ctx.assert.throws(
      () => forager.tag.parent_create({ child_tag: 'genre:animation', parent_tag: 'genre:cartoon' }),
      errors.BadInputError,
    )
  })

  await ctx.subtest('multi-level circular parent detection', () => {
    // animation -> cartoon already exists. add cartoon -> fractal
    forager.tag.parent_create({ child_tag: 'genre:fractal', parent_tag: 'genre:cartoon' })
    // now fractal -> animation should be rejected (fractal -> cartoon -> animation is a cycle)
    ctx.assert.throws(
      () => forager.tag.parent_create({ child_tag: 'genre:animation', parent_tag: 'genre:fractal' }),
      errors.BadInputError,
    )
  })

  await ctx.subtest('delete parent', () => {
    const result = forager.tag.parent_create({ child_tag: 'genre:fractal', parent_tag: 'genre:animation' })
    ctx.assert.list_partial(forager.tag.get({ slug: 'genre:animation' }).children, [
      { slug: 'genre:cartoon' },
      { slug: 'genre:fractal' },
    ])

    forager.tag.parent_delete({ id: result.rule.id })

    ctx.assert.list_partial(forager.tag.get({ slug: 'genre:animation' }).children, [
      { slug: 'genre:cartoon' },
    ])
  })

  await ctx.subtest('parent when source tag does not exist yet', () => {
    const result = forager.tag.parent_create({ child_tag: 'genre:anime', parent_tag: 'genre:animation' })
    ctx.assert.object_match(result.rule, {
      child_tag_slug: 'genre:anime',
      parent_tag_slug: 'genre:animation',
    })
    // source tag has no DB record, so child detail is null
    ctx.assert.equals(result.child, null)
    ctx.assert.object_match(result.parent.tag, { name: 'animation' })

    // anime has no DB record, so it won't appear in resolved children
    const animation = forager.tag.get({ slug: 'genre:animation' })
    ctx.assert.list_partial(animation.children, [
      { slug: 'genre:cartoon' },
    ])
  })
})


test('tag update', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  await forager.media.create(ctx.resources.media_files['koch.tif'], {}, ['genre:fractal', 'wallpaper'])

  await ctx.subtest('update tag name', () => {
    forager.tag.update({ slug: 'genre:fractal', name: 'fractals' })
    const detail = forager.tag.get({ slug: 'genre:fractals' })
    ctx.assert.object_match(detail.tag, { name: 'fractals', group: 'genre' })
  })

  await ctx.subtest('update tag group', () => {
    forager.tag.update({ slug: 'genre:fractals', group: 'art' })
    const detail = forager.tag.get({ slug: 'art:fractals' })
    ctx.assert.object_match(detail.tag, { name: 'fractals', group: 'art' })
  })

  await ctx.subtest('update tag description', () => {
    forager.tag.update({ slug: 'art:fractals', description: 'Mathematical art' })
    const detail = forager.tag.get({ slug: 'art:fractals' })
    ctx.assert.object_match(detail.tag, { description: 'Mathematical art' })
  })

  await ctx.subtest('cannot rename to existing slug', () => {
    ctx.assert.throws(
      () => forager.tag.update({ slug: 'art:fractals', name: 'wallpaper', group: '' }),
      errors.BadInputError,
    )
  })

  await ctx.subtest('cannot rename tag with existing rules', () => {
    forager.tag.alias_create({ alias_tag: 'wallpaper', alias_for_tag: 'art:fractals' })
    ctx.assert.throws(
      () => forager.tag.update({ slug: 'art:fractals', name: 'fractal_images' }),
      errors.BadInputError,
    )
  })

  await ctx.subtest('get nonexistent tag throws NotFoundError', () => {
    ctx.assert.throws(
      () => forager.tag.get({ slug: 'nonexistent:tag' }),
      errors.NotFoundError,
    )
  })
})


test('tag rules respected during media operations', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  // seed some media with tags so the tags exist in the DB
  await forager.media.create(ctx.resources.media_files['koch.tif'], {}, ['animal:cat', 'animal:kitty', 'genre:cartoon', 'genre:animation'])
  await forager.media.create(ctx.resources.media_files['ed-edd-eddy.png'], {}, ['mood:relaxed', 'mood:chill', 'style:pixel_art', 'style:digital'])

  await ctx.subtest('media.create resolves alias tags to canonical', async () => {
    forager.tag.alias_create({ alias_tag: 'animal:kitty', alias_for_tag: 'animal:cat' })

    const media = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {}, ['animal:kitty'])
    // kitty is an alias for cat, so the media should have cat instead
    ctx.assert.list_partial(media.tags, [
      { name: 'cat', group: 'animal' },
    ])
  })

  await ctx.subtest('media.update resolves alias tags to canonical', () => {
    const media = forager.media.search()
    const media_ref_id = media.results[0].media_reference.id

    forager.tag.alias_create({ alias_tag: 'mood:chill', alias_for_tag: 'mood:relaxed' })
    forager.media.update(media_ref_id, {}, { add: ['mood:chill'] })

    const updated = forager.media.get({ media_reference_id: media_ref_id })
    const tag_slugs = updated.tags.map(t => t.slug)
    ctx.assert.list_includes(tag_slugs, ['mood:relaxed'])
  })

  await ctx.subtest('media.create applies parent tags', async () => {
    // remove existing tags from cat_doodle so we can test fresh
    const cat_doodle = forager.media.search().results.find(r => r.media_type === 'media_file' && r.media_file.filename === 'cat_doodle.jpg')!
    forager.media.update(cat_doodle.media_reference.id, {}, { replace: [] })

    forager.tag.parent_create({ child_tag: 'genre:cartoon', parent_tag: 'genre:animation' })

    forager.media.update(cat_doodle.media_reference.id, {}, { add: ['genre:cartoon'] })
    const updated = forager.media.get({ media_reference_id: cat_doodle.media_reference.id })
    const tag_slugs = updated.tags.map(t => t.slug)
    ctx.assert.list_includes(tag_slugs, ['genre:cartoon', 'genre:animation'])
  })

  await ctx.subtest('media.update applies parent tags', () => {
    const media = forager.media.search()
    const media_ref_id = media.results[0].media_reference.id

    forager.tag.parent_create({ child_tag: 'style:pixel_art', parent_tag: 'style:digital' })
    forager.media.update(media_ref_id, {}, { add: ['style:pixel_art'] })

    const updated = forager.media.get({ media_reference_id: media_ref_id })
    const tag_slugs = updated.tags.map(t => t.slug)
    ctx.assert.list_includes(tag_slugs, ['style:pixel_art', 'style:digital'])
  })
})


test('tag rule undo', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  await forager.media.create(ctx.resources.media_files['koch.tif'], {}, ['animal:cat'])
  await forager.media.create(ctx.resources.media_files['ed-edd-eddy.png'], {}, ['animal:kitty'])
  await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {}, ['genre:cartoon', 'genre:animation'])

  await ctx.subtest('alias_delete undoes media_reference_tag changes', () => {
    const cat_before = forager.tag.get({ slug: 'animal:cat' })
    ctx.assert.equals(cat_before.tag.media_reference_count, 1)

    const result = forager.tag.alias_create({ alias_tag: 'animal:kitty', alias_for_tag: 'animal:cat' })
    ctx.assert.object_match(forager.tag.get({ slug: 'animal:cat' }).tag, { media_reference_count: 2 })

    forager.tag.alias_delete({ id: result.rule.id })
    ctx.assert.object_match(forager.tag.get({ slug: 'animal:cat' }).tag, { media_reference_count: 1 })
  })

  await ctx.subtest('parent_delete undoes media_reference_tag changes', () => {
    // cat_doodle has cartoon and animation. Create parent rule cartoon->animation.
    // animation is already on cat_doodle so get_or_create is a no-op for that media.
    // But koch.tif doesn't have cartoon, so nothing propagates there.
    const animation_before = forager.tag.get({ slug: 'genre:animation' })
    ctx.assert.equals(animation_before.tag.media_reference_count, 1)

    // add cartoon to koch.tif so the parent rule propagates animation to it
    forager.media.update(
      forager.media.search().results.find(r => r.media_type === 'media_file' && r.media_file.filename === 'koch.tif')!.media_reference.id,
      {}, { add: ['genre:cartoon'] }
    )

    const result = forager.tag.parent_create({ child_tag: 'genre:cartoon', parent_tag: 'genre:animation' })
    // animation should now be on koch.tif too (from the parent rule)
    ctx.assert.object_match(forager.tag.get({ slug: 'genre:animation' }).tag, { media_reference_count: 2 })

    forager.tag.parent_delete({ id: result.rule.id })
    // only the rule-created row (koch.tif) should be removed; cat_doodle's manual animation stays
    ctx.assert.object_match(forager.tag.get({ slug: 'genre:animation' }).tag, { media_reference_count: 1 })
  })

  await ctx.subtest('alias_delete does not remove manually-added tags', () => {
    const cat_doodle = forager.media.search().results.find(r => r.media_type === 'media_file' && r.media_file.filename === 'cat_doodle.jpg')!
    const ed = forager.media.search().results.find(r => r.media_type === 'media_file' && r.media_file.filename === 'ed-edd-eddy.png')!

    // restore kitty on ed-edd-eddy (lost from subtest 1's undo)
    forager.media.update(ed.media_reference.id, {}, { add: ['animal:kitty'] })
    // manually add animal:cat to cat_doodle (no rule involved)
    forager.media.update(cat_doodle.media_reference.id, {}, { add: ['animal:cat'] })

    const cat_count_before = forager.tag.get({ slug: 'animal:cat' }).tag.media_reference_count

    // create alias kitty->cat, migrating ed-edd-eddy's kitty to cat
    const result = forager.tag.alias_create({ alias_tag: 'animal:kitty', alias_for_tag: 'animal:cat' })
    ctx.assert.equals(
      forager.tag.get({ slug: 'animal:cat' }).tag.media_reference_count,
      cat_count_before + 1,
    )

    // delete the alias — should only undo the rule-created row, not the manual one
    forager.tag.alias_delete({ id: result.rule.id })
    ctx.assert.equals(
      forager.tag.get({ slug: 'animal:cat' }).tag.media_reference_count,
      cat_count_before,
    )
  })

  await ctx.subtest('media.create with alias tracks tag_alias_id', async () => {
    const ed = forager.media.search().results.find(r => r.media_type === 'media_file' && r.media_file.filename === 'ed-edd-eddy.png')!
    forager.media.update(ed.media_reference.id, {}, { add: ['animal:kitty'] })

    const alias_result = forager.tag.alias_create({ alias_tag: 'animal:kitty', alias_for_tag: 'animal:cat' })

    const cat_before = forager.tag.get({ slug: 'animal:cat' }).tag.media_reference_count

    // create media with the alias tag — should resolve to cat via alias
    const media = await forager.media.create(ctx.resources.media_files['blink.gif'], {}, ['animal:kitty'])
    ctx.assert.list_partial(media.tags, [{ name: 'cat', group: 'animal' }])
    ctx.assert.equals(forager.tag.get({ slug: 'animal:cat' }).tag.media_reference_count, cat_before + 1)

    // delete the alias rule — removes ALL rows created by this alias (migration + media.create)
    forager.tag.alias_delete({ id: alias_result.rule.id })

    // cat_before included the migrated ed-edd-eddy row, so count drops below cat_before
    ctx.assert.equals(forager.tag.get({ slug: 'animal:cat' }).tag.media_reference_count, cat_before - 1)
  })

  await ctx.subtest('media.update with parent tracks tag_parent_id', () => {
    const ed = forager.media.search().results.find(r => r.media_type === 'media_file' && r.media_file.filename === 'ed-edd-eddy.png')!
    const media_ref_id = ed.media_reference.id

    // use tags that already exist in the DB
    const result = forager.tag.parent_create({ child_tag: 'genre:cartoon', parent_tag: 'genre:animation' })
    forager.media.update(media_ref_id, {}, { add: ['genre:cartoon'] })

    const updated = forager.media.get({ media_reference_id: media_ref_id })
    ctx.assert.list_includes(updated.tags.map(t => t.slug), ['genre:animation'])

    // delete the parent rule — animation should be removed from ed-edd-eddy
    forager.tag.parent_delete({ id: result.rule.id })

    const after = forager.media.get({ media_reference_id: media_ref_id })
    ctx.assert.equals(after.tags.map(t => t.slug).includes('genre:animation'), false)
  })
})
