import { test } from 'forager-test'
import { Forager } from '~/mod.ts'

test('media edit log', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const media_info = { title: 'Generated Art', stars: 2 }
  const tags = [
    { group: '', name: 'Procedural Generation' },
    { group: '', name: 'wallpaper' },
  ]
  let media_generated_art = await forager.media.create(ctx.resources.media_files['koch.tif'], media_info, tags, {editor: 'manual'})
  // this field will be present on individual gets and during listing
  ctx.assert.equals(media_generated_art.media_reference.editors, ["manual"])
  ctx.assert.search_result(forager.media.search(), {
    results: [
      {
        media_reference: {editors: ["manual"]}
      }
    ]
  })

  // now lets check the full edit log retrieval from creates/updates/gets
  ctx.assert.list_partial(media_generated_art.edit_log!, [{
    media_reference_id: media_generated_art.media_reference.id,
    editor: 'manual',
    operation_type: 'CREATE',
    changes: {
      media_info: {
        title: 'Generated Art',
        stars: 2
      },
      tags: {
        added: ['procedural_generation', 'wallpaper'],
        removed: []
      }
    }
  }])

  await ctx.subtest(`editor update overwrite logic`, () => {
    media_generated_art = forager.media.update(media_generated_art.media_reference.id, {
      title: 'Generated Geometric Art',
      description: 'this is an image generated in the processing programming language',
    }, {
      // NOTE that we have the same tag in here again, so it should _not_ be shown as removed in the edit_log, though we will see procedural_generation removed
      replace: ['geometric', 'wallpaper'],
    }, {editor: 'manual'})

    ctx.assert.object_match(media_generated_art.media_reference, {
      title: 'Generated Geometric Art',
    })
    ctx.assert.list_partial(media_generated_art.edit_log!, [
      {
        media_reference_id: media_generated_art.media_reference.id,
        editor: 'manual',
        operation_type: 'UPDATE',
        changes: {
          media_info: {
            title: 'Generated Geometric Art',
            description: 'this is an image generated in the processing programming language',
          },
          tags: {
            added: ['geometric'],
            removed: ['procedural_generation']
          }
        }
      },
      {
        media_reference_id: media_generated_art.media_reference.id,
        editor: 'manual',
        operation_type: 'CREATE',
        changes: {
          media_info: {
            title: 'Generated Art',
            stars: 2
          },
          tags: {
            added: ['procedural_generation', 'wallpaper'],
            removed: []
          }
        }
      },
    ])
  })

  await ctx.subtest(`editor update non overwrite logic`, () => {
    media_generated_art = forager.media.update(media_generated_art.media_reference.id, {
      title: 'Update 3',
    }, {
      // this should _replace_ tags from the "automated_script" editor, but not the "manual" editor
      replace: ['color:black'],
    }, {editor: 'automated_script', overwrite: false})

    ctx.assert.list_partial(media_generated_art.tags, [
      {group: 'color', name: 'black'},
      {group: '', name: 'geometric'},
      {group: '', name: 'wallpaper'},
    ], (a, b) => a.name.localeCompare(b.name))
    ctx.assert.equals(media_generated_art.edit_log?.length, 3)
    ctx.assert.equals(media_generated_art.edit_log![0].editor, 'automated_script')
    ctx.assert.equals(media_generated_art.edit_log![0].changes, {
      media_info: {},
      tags: {
        added: ['color:black'],
        removed: []
      }
    })

    // now lets make sure we can still replace tags edited by "ourselves"

    media_generated_art = forager.media.update(media_generated_art.media_reference.id, {
      metadata: {foo: 'bar'}
    }, {
      // this should _replace_ tags from the "automated_script" editor, but not the "manual" editor
      replace: ['color:white'],
    }, {editor: 'automated_script', overwrite: false})

    ctx.assert.equals(media_generated_art.media_reference.metadata, {foo: 'bar'})
    ctx.assert.list_partial(media_generated_art.tags, [
      {group: '', name: 'geometric'},
      {group: '', name: 'wallpaper'},
      {group: 'color', name: 'white'},
    ], (a, b) => a.name.localeCompare(b.name))
    ctx.assert.equals(media_generated_art.edit_log?.length, 4)
    ctx.assert.equals(media_generated_art.edit_log![0].editor, 'automated_script')
    ctx.assert.equals(media_generated_art.edit_log![0].changes, {
      media_info: {
        metadata: {foo: 'bar'}
      },
      tags: {
        added: ['color:white'],
        removed: ['color:black'],
      }
    })
  })


  await ctx.subtest('editor defined via config', () => {
    forager.config.editing = {
      editor: 'default-manual-user',
      overwrite: true
    }

    const source_created_at = new Date('2012/2/3')
    media_generated_art = forager.media.update(media_generated_art.media_reference.id, {source_created_at})
    ctx.assert.equals(media_generated_art.media_reference.source_created_at, source_created_at)
  })
})

test('editor replace ownership', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()
  const by_slug = (a: {group: string, name: string}, b: {group: string, name: string}) => `${a.group}:${a.name}`.localeCompare(`${b.group}:${b.name}`)

  const media = await forager.media.create(ctx.resources.media_files['koch.tif'], {}, ['no_editor_tag'])
  const id = media.media_reference.id
  forager.media.update(id, {title: 'bar title'}, {add: ['bar_tag']}, {editor: 'bar'})

  await ctx.subtest('replace with an editor keeps tags from other editors and tags without an editor', () => {
    const updated = forager.media.update(id, {}, ['my:tag'], {editor: 'foo'})
    ctx.assert.list_partial(updated.tags, [
      {group: '', name: 'bar_tag'},
      {group: '', name: 'no_editor_tag'},
      {group: 'my', name: 'tag'},
    ], by_slug)
    ctx.assert.equals(updated.edit_log![0].changes.tags, {added: ['my:tag'], removed: []})
  })

  await ctx.subtest('replace with an editor replaces tags owned by that editor', () => {
    const updated = forager.media.update(id, {}, ['my:other_tag'], {editor: 'foo', overwrite: false})
    ctx.assert.list_partial(updated.tags, [
      {group: '', name: 'bar_tag'},
      {group: '', name: 'no_editor_tag'},
      {group: 'my', name: 'other_tag'},
    ], by_slug)
    ctx.assert.equals(updated.edit_log![0].changes.tags, {added: ['my:other_tag'], removed: ['my:tag']})
  })

  await ctx.subtest('an editor does not overwrite media info fields owned by other editors by default', () => {
    const updated = forager.media.update(id, {title: 'foo title', description: 'foo description'}, undefined, {editor: 'foo'})
    ctx.assert.equals(updated.media_reference.title, 'bar title')
    ctx.assert.equals(updated.media_reference.description, 'foo description')
  })

  await ctx.subtest('overwrite replaces tags and media info from all editors', () => {
    const updated = forager.media.update(id, {title: 'foo title'}, ['my:tag'], {editor: 'foo', overwrite: true})
    ctx.assert.equals(updated.media_reference.title, 'foo title')
    ctx.assert.list_partial(updated.tags, [{group: 'my', name: 'tag'}])
  })

  await ctx.subtest('replace without an editor replaces all tags', () => {
    forager.media.update(id, {}, {add: ['bar_tag']}, {editor: 'bar'})
    const updated = forager.media.update(id, {}, ['no_editor_tag'])
    ctx.assert.list_partial(updated.tags, [{group: '', name: 'no_editor_tag'}])
  })
})
