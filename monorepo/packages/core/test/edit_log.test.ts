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

})
