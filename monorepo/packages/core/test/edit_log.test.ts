import { test } from 'forager-test'
import * as fs from '@std/fs'
import * as path from '@std/path'
import { Forager, errors } from '~/mod.ts'

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

  console.log('media reference create edit log', media_generated_art.edit_log)
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
        added: [':procedural_generation', ':wallpaper'],
        removed: []
      }
    }
  }])

  /*
    * TODO add edit log to updates (this is the real magic)
  media_generated_art = await forager.media.update(media_generated_art.media_reference.id, {
    title: 'Generated Geometric Art',
    description: 'this is an image generated in the processing programming language',
  }, {
    // NOTE that we have the same tag in here again, so it should _not_ be shown as removed in the edit_log, though we will see procedural_generation removed
    replace: ['geometric', 'wallpaper']
  }, {editor: 'manual'})

  */
})
