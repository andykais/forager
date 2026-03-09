import { test } from 'forager-test'
import { Forager, errors } from '~/mod.ts'


test('tag alias', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  await forager.media.create(ctx.resources.media_files['koch.tif'], {}, ['animal:cat', 'wallpaper'])
  await forager.media.create(ctx.resources.media_files['ed-edd-eddy.png'], {}, ['animal:cat', 'animal:dog'])
  await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {}, ['animal:kitty'])

  await ctx.subtest('create alias migrates media_reference_tag rows', () => {
    const result = forager.tag.alias_create({
      source_tag: 'animal:kitty',
      target_tag: 'animal:cat',
    })

    ctx.assert.object_match(result.rule, {
      source_tag_slug: 'animal:kitty',
      target_tag_slug: 'animal:cat',
    })
    ctx.assert.object_match(result.alias.tag, { name: 'kitty', group: 'animal', media_reference_count: 0 })
    ctx.assert.object_match(result.alias_target.tag, { name: 'cat', group: 'animal', media_reference_count: 3 })
  })

  await ctx.subtest('get shows alias relationships', () => {
    const kitty_detail = forager.tag.get({ slug: 'animal:kitty' })
    ctx.assert.object_match(kitty_detail.alias_target!, { name: 'cat', group: 'animal' })
    ctx.assert.equals(kitty_detail.aliases.length, 0)

    const cat_detail = forager.tag.get({ slug: 'animal:cat' })
    ctx.assert.equals(cat_detail.alias_target, null)
    ctx.assert.equals(cat_detail.aliases.length, 1)
    ctx.assert.object_match(cat_detail.aliases[0], { name: 'kitty', group: 'animal' })
  })

  await ctx.subtest('cannot create duplicate alias', () => {
    ctx.assert.throws(
      () => forager.tag.alias_create({ source_tag: 'animal:kitty', target_tag: 'animal:cat' }),
      errors.BadInputError,
    )
  })

  await ctx.subtest('cannot alias a tag to itself', () => {
    ctx.assert.throws(
      () => forager.tag.alias_create({ source_tag: 'animal:cat', target_tag: 'animal:cat' }),
      errors.BadInputError,
    )
  })

  await ctx.subtest('cannot alias to a tag that is itself an alias', () => {
    ctx.assert.throws(
      () => forager.tag.alias_create({ source_tag: 'wallpaper', target_tag: 'animal:kitty' }),
      errors.BadInputError,
    )
  })

  await ctx.subtest('delete alias', () => {
    const cat_before = forager.tag.get({ slug: 'animal:cat' })
    ctx.assert.equals(cat_before.aliases.length, 1)

    // create a second alias and then delete it
    const wallpaper_result = forager.tag.alias_create({ source_tag: 'wallpaper', target_tag: 'animal:cat' })
    const cat_with_two = forager.tag.get({ slug: 'animal:cat' })
    ctx.assert.equals(cat_with_two.aliases.length, 2)

    forager.tag.alias_delete({ id: wallpaper_result.rule.id })

    const cat_after = forager.tag.get({ slug: 'animal:cat' })
    ctx.assert.equals(cat_after.aliases.length, 1)
    ctx.assert.object_match(cat_after.aliases[0], { name: 'kitty' })
  })

  await ctx.subtest('alias tag that has a parent relationship', () => {
    // dog has a parent "animal:cat" (as a parent rule)
    forager.tag.parent_create({ source_tag: 'animal:dog', target_tag: 'animal:cat' })

    const dog_before = forager.tag.get({ slug: 'animal:dog' })
    ctx.assert.equals(dog_before.tag.media_reference_count, 1)
    ctx.assert.equals(dog_before.parents.length, 1)

    // now alias dog to cat — dog's media should move to cat
    const result = forager.tag.alias_create({ source_tag: 'animal:dog', target_tag: 'animal:cat' })
    ctx.assert.equals(result.alias.tag.media_reference_count, 0)
    // cat already had 3 from earlier alias, and wallpaper alias was deleted restoring 1, so cat=3 + dog's 1 = 4
    // but dog's media_reference was ed-edd-eddy which already has animal:cat, so get_or_create is a no-op
    ctx.assert.equals(result.alias_target.tag.media_reference_count, 3)
  })
})


test('tag parent', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  await forager.media.create(ctx.resources.media_files['koch.tif'], {}, ['genre:fractal', 'genre:animation'])
  await forager.media.create(ctx.resources.media_files['ed-edd-eddy.png'], {}, ['genre:cartoon'])
  await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {}, ['genre:cartoon', 'genre:fractal'])

  await ctx.subtest('create parent propagates to existing media', () => {
    // animation has 1 media ref (koch.tif). cartoon has 2 (ed-edd-eddy, cat_doodle).
    // making animation the parent of cartoon should add animation to ed-edd-eddy and cat_doodle
    const result = forager.tag.parent_create({
      source_tag: 'genre:cartoon',
      target_tag: 'genre:animation',
    })

    ctx.assert.object_match(result.rule, {
      source_tag_slug: 'genre:cartoon',
      target_tag_slug: 'genre:animation',
    })
    ctx.assert.object_match(result.child.tag, { name: 'cartoon', media_reference_count: 2 })
    // animation: koch.tif (already had it) + ed-edd-eddy + cat_doodle = 3
    ctx.assert.object_match(result.parent.tag, { name: 'animation', media_reference_count: 3 })
  })

  await ctx.subtest('get shows parent/child relationships', () => {
    const cartoon_detail = forager.tag.get({ slug: 'genre:cartoon' })
    ctx.assert.equals(cartoon_detail.parents.length, 1)
    ctx.assert.object_match(cartoon_detail.parents[0], { name: 'animation', group: 'genre' })
    ctx.assert.equals(cartoon_detail.children.length, 0)

    const animation_detail = forager.tag.get({ slug: 'genre:animation' })
    ctx.assert.equals(animation_detail.children.length, 1)
    ctx.assert.object_match(animation_detail.children[0], { name: 'cartoon', group: 'genre' })
    ctx.assert.equals(animation_detail.parents.length, 0)
  })

  await ctx.subtest('cannot parent a tag to itself', () => {
    ctx.assert.throws(
      () => forager.tag.parent_create({ source_tag: 'genre:cartoon', target_tag: 'genre:cartoon' }),
      errors.BadInputError,
    )
  })

  await ctx.subtest('circular parent detection', () => {
    ctx.assert.throws(
      () => forager.tag.parent_create({ source_tag: 'genre:animation', target_tag: 'genre:cartoon' }),
      errors.BadInputError,
    )
  })

  await ctx.subtest('delete parent', () => {
    // create a second parent rule and delete it
    const result = forager.tag.parent_create({ source_tag: 'genre:fractal', target_tag: 'genre:animation' })

    const animation_detail = forager.tag.get({ slug: 'genre:animation' })
    ctx.assert.equals(animation_detail.children.length, 2)

    forager.tag.parent_delete({ id: result.rule.id })

    const animation_after = forager.tag.get({ slug: 'genre:animation' })
    ctx.assert.equals(animation_after.children.length, 1)
    ctx.assert.object_match(animation_after.children[0], { name: 'cartoon' })
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
    // create alias using wallpaper (which exists) as source
    forager.tag.alias_create({ source_tag: 'wallpaper', target_tag: 'art:fractals' })
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
