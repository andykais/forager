import { test } from 'forager-test'
import * as fs from '@std/fs'
import * as path from '@std/path'
import { Forager, errors } from '~/mod.ts'


/* A note about future test suite improvements:
 * currently tests have one setup that is shared amongst subtests.
 * It may be smarter to move this setup to a "before" step for each subtest.
 * An Alternative if we dont like "before" steps, we can move all this initialization to helper functions.
 * This second approach lends itself well to a class structure. Im not sure what that would look like though

 ` ````````````````````````````````````````````````````````````````````````````````````````````````````````````````
 `  class MediaActionTests(TestSuite) {
 `
 `    test_setup() {
 `      const database_path = ctx.create_fixture_path('forager.db')
 `      const thumbnail_folder = ctx.create_fixture_path('thumbnails')
 `      const forager = new Forager({ database_path, thumbnail_folder })
 `      forager.init()
 `      // do the rest of your setup...
 `    }
 `
 `    /* we could let the method name prefix determine what a test is like python's unittest
 `
 `     ` ````````````````````````````````````````````````````````````````````````````````````````````````````````````````
 `     `  tests = {
 `     `    'search sort order': () => {
 `     `      ctx.assert.search_result(forager.media.search({sort_by: 'created_at'}), {
 `     `        results: [
 `     `          {media_reference: {id: media_doodle.media_reference.id}},
 `     `          {media_reference: {id: media_cartoon.media_reference.id}},
 `     `          {media_reference: {id: media_generated_art.media_reference.id}},
 `     `        ]
 `     `      })
 `     `    }
 `     `  }
 `     `
 `     ` ````````````````````````````````````````````````````````````````````````````````````````````````````````````````
 `
 `     * we could use a decorator to register tests
 `
 `
 `     ` ````````````````````````````````````````````````````````````````````````````````````````````````````````````````
 `     `  @test()
 `     `  test_sort_order() {
 `     `    ctx.assert.search_result(forager.media.search({sort_by: 'created_at'}), {
 `     `      results: [
 `     `        {media_reference: {id: media_doodle.media_reference.id}},
 `     `        {media_reference: {id: media_cartoon.media_reference.id}},
 `     `        {media_reference: {id: media_generated_art.media_reference.id}},
 `     `      ]
 `     `    })
 `     `  }
 `     `
 `     ` ````````````````````````````````````````````````````````````````````````````````````````````````````````````````
 `     * ONLY issue with nested code blocks is that you cant close the inner comment block and have valid js syntax
 `
 `  }
 `
 ` ````````````````````````````````````````````````````````````````````````````````````````````````````````````````
 */
test('media actions', async (ctx) => {
  const forager = new Forager(ctx.get_test_config())
  forager.init()

  const media_info = { title: 'Generated Art', stars: 2 }
  const tags = [
    // this one should transform capitals and spaces for us
    { group: '', name: 'Procedural Generation' },
    // this one is here so we can ensure different tags can exist for the same tag group id
    { group: '', name: 'generated' },
    // this is a different tag group
    { group: 'colors', name: 'black' },
    // this is a shorthand tag declaration
    'wallpaper',
  ]
  const media_generated_art = await forager.media.create(ctx.resources.media_files['koch.tif'], media_info, tags)
  // silly checks, SQLITE will always make the first row id `1`. This is just a simple smoke test that we actually wrote something to the db
  ctx.assert.equals(media_generated_art.media_file.id, 1)
  ctx.assert.equals(media_generated_art.media_reference.id, 1)
  ctx.assert.equals(media_generated_art.media_file.filepath, ctx.resources.media_files["koch.tif"])
  // TODO add 'group' back into tags results
  /*
  ctx.assert.list_partial(media_generated_art.tags, [
    {name: 'black', group: 'colors'},
    {name: 'generated', group: ''},
    {name: 'procedural_generation', group: ''},
    {name: 'wallpaper', group: ''},
  ], (a, b) => a.name.localeCompare(b.name))
  */

  let media_cartoon = await forager.media.create(ctx.resources.media_files["ed-edd-eddy.png"], {title: 'Ed Edd Eddy Screengrab'}, ['cartoon', 'wallpaper'])
  ctx.assert.equals(media_cartoon.media_file.filepath, ctx.resources.media_files["ed-edd-eddy.png"])
  // TODO same here, missing 'group' join
  /*
  ctx.assert.list_partial(media_cartoon.tags, [
    {name: 'cartoon', group: ''},
    {name: 'wallpaper', group: ''},
  ])
  */
  let media_doodle = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {title: 'Cat Doodle'}, [])

  await ctx.subtest('thumbnail generation', async () => {
    const checksums = {
      generated_art: 'e00df1e96425e0f231bb0cf065432927933f6f2ffd397119334bd2b0b307923f',
      cartoon: '13df03de07b03af9d01667c8a32ef3779a1f3724817b35ffa34909a5d45dc2c6',
      doodle: 'ee704bb3e4a8ef14bf2825480b4d5e4057be76d4c22386295b7eeaa7278175b2',
    }
    const thumbnails = await Array.fromAsync(fs.walk(forager.config.thumbnails.folder))
    ctx.assert.list_includes([
      forager.config.thumbnails.folder,
      path.join(forager.config.thumbnails.folder, 'e0'),
      path.join(forager.config.thumbnails.folder, 'e0', checksums.generated_art),
      path.join(forager.config.thumbnails.folder, 'e0', checksums.generated_art, '0001.jpg'),
      path.join(forager.config.thumbnails.folder, '13'),
      path.join(forager.config.thumbnails.folder, '13', checksums.cartoon),
      path.join(forager.config.thumbnails.folder, '13', checksums.cartoon, '0001.jpg'),
      path.join(forager.config.thumbnails.folder, 'ee'),
      path.join(forager.config.thumbnails.folder, 'ee', checksums.doodle),
      path.join(forager.config.thumbnails.folder, 'ee', checksums.doodle, '0001.jpg'),
    ], thumbnails.map(entry => entry.path))
  })

  await ctx.subtest('duplicate media creation guards', async () => {
    await ctx.assert.rejects(
      async () => forager.media.create(ctx.resources.media_files['koch.tif']),
      errors.MediaAlreadyExistsError
    )
  })

  await ctx.subtest('default search behavior', () => {
    ctx.assert.search_result(forager.media.search(), {
      total: 3,
      results: [
        {media_reference: {title: 'Cat Doodle'}},
        {media_reference: {title: 'Ed Edd Eddy Screengrab'}},
        {media_reference: {title: 'Generated Art'}},
      ],
    })
  })

  await ctx.subtest('default search arguments', () => {
    ctx.assert.search_result(forager.media.search({cursor: undefined, limit: -1}), {
      total: 3,
      results: [
        {media_reference: {title: 'Cat Doodle'}},
        {media_reference: {title: 'Ed Edd Eddy Screengrab'}},
        {media_reference: {title: 'Generated Art'}},
      ],
    })
  })

  await ctx.subtest('using search for total counts only', () => {
    ctx.assert.search_result(forager.media.search({limit: 0}), {
      total: 3,
      cursor: undefined,
      results: []
    })
  })
  await ctx.subtest('search pagination', () => {
    const media_list_page_1 = forager.media.search({limit: 2})
    ctx.assert.search_result(media_list_page_1, {
      results: [
        {media_reference: {title: 'Cat Doodle'}},
        {media_reference: {title: 'Ed Edd Eddy Screengrab'}},
      ],
      total: 3
    })
    ctx.assert.not_equals(media_list_page_1.cursor, undefined)

    const media_list_page_2 = forager.media.search({cursor: media_list_page_1.cursor, limit: 2})
    ctx.assert.object_match(media_list_page_2, {
      results: [
        {media_reference: {title: 'Generated Art'}},
      ]
    })
  })

  await ctx.subtest('search filters media_reference_id', () => {
    ctx.assert.search_result(forager.media.search({query: {media_reference_id: media_generated_art.media_reference.id}}), {
      total: 1,
      results: [
        {media_reference: {id: media_generated_art.media_reference.id, title: 'Generated Art'}}
      ],
    })

    // assert filepaths
    ctx.assert.search_result(forager.media.search({query: {media_reference_id: media_generated_art.media_reference.id}}), {
      results: [
        {media_file: {filepath: ctx.resources.media_files["koch.tif"]}}
      ]
    })
  })

  await ctx.subtest('search filters tags', () => {
    ctx.assert.search_result(forager.media.search({query: { tags: ['procedural_generation'] }}), {
      total: 1,
      results: [{media_reference: {id: media_generated_art.media_reference.id}}]
    })

    ctx.assert.search_result(forager.media.search({query: { tags: ['wallpaper'] }}), {
      total: 2,
      results: [
        {media_reference: {id: media_cartoon.media_reference.id}},
        {media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })

    // test using multiple tags in a search
    ctx.assert.search_result(forager.media.search({query: { tags: ['wallpaper', 'colors:black'] }}), {
      total: 1,
      results: [
        {media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })

    // an empty list should act like a noop
    ctx.assert.search_result(forager.media.search({query: { tags: [] }}), {
      total: 3,
      results: [
        {media_reference: {id: media_doodle.media_reference.id}},
        {media_reference: {id: media_cartoon.media_reference.id}},
        {media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })

    // check that pagination works with tag filters
    const wallpaper_media_page_1 = forager.media.search({query: { tags: ['wallpaper'] }, limit: 1})
    ctx.assert.not_equals(wallpaper_media_page_1.cursor, undefined)
    const wallpaper_media_page_2 = forager.media.search({query: { tags: ['wallpaper'] }, limit: 1, cursor: wallpaper_media_page_1.cursor})
    ctx.assert.not_equals(wallpaper_media_page_2.cursor, undefined)
    const wallpaper_media_page_3 = forager.media.search({query: { tags: ['wallpaper'] }, limit: 1, cursor: wallpaper_media_page_2.cursor})
    ctx.assert.search_result(wallpaper_media_page_1, {
      total: 2,
      results: [
        {media_reference: {id: media_cartoon.media_reference.id}},
      ]
    })
    ctx.assert.search_result(wallpaper_media_page_2, {
      total: 2,
      results: [
        {media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })
    ctx.assert.search_result(wallpaper_media_page_3, {
      total: 2,
      results: []
    })

    // non existent tags should bubble up NotFoundError on the tag
    ctx.assert.throws(
      () => forager.media.search({query: {tags: ['nonexistent_tag']}}),
      errors.NotFoundError,
      'Tag "{"name":"nonexistent_tag","group":""}" does not exist'
    )
  })

  await ctx.subtest('search media grouping', async () => {
    /* two design proposals here. Just comment them out to get rid of compiler errors.
     * Ideally we should commit to one before building our UI
     *
     * So heres my logic with adding it to the MediaAction::search api.
     * Avoiding inputs changing the type returned by an output is useful,
     * but the ui display isnt going to care about different top level types.
     * It just needs to know how to render a particular item in the results

      ````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````
      ` // My TS type returns grouped search results alongside 'media_series' | 'media_file'
      ` const result = forager.media.search({group_by: {tag_group: 'art'}, query: {}})
      `
      ` // My TS type only returns grouped search results
      ` const result = forager.media.search_group_by({tag_group: 'art', query: {directory: ctx.resources.resources_directory}})
        console.log(result)
      `
      ````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````
     */
  })

  /*
  await ctx.subtest('filesystem browsing', () => {
    // basic workflows: starting at the top level dir
    const root_dir = path.parse(Deno.cwd()).root
    const root_result = forager.media.search({query: {filesystem: true}})
    ctx.assert.search_result(root_result, {
      total: 1,
      results: [
        {
          media_reference: { directory_path: root_dir }
        }
      ]
    })
    // then lets query the contents of that dir (directory: string implies filesystem: true)
    ctx.assert.search_result(forager.media.search({query: {directory: root_dir}}), {
      // a test might be ran from anywhere, so we can really only verify that something exists below the root here
      total: 1,
    })

    ctx.assert.search_result(forager.media.search({query: {directory: ctx.resources.resources_directory}}), {
      total: 3,
      results: [
        {media_reference: {id: media_doodle.media_reference.id}},
        {media_reference: {id: media_cartoon.media_reference.id}},
        {media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })

    // test exact file queries
    ctx.assert.search_result(forager.media.search({query: {filepath: media_cartoon.media_file.filepath}}), {
      total: 1,
      results: [
        {media_reference: {id: media_cartoon.media_reference.id}}
      ]
    })

    // test directory glob queries
    ctx.assert.search_result(forager.media.search({query: {filepath: `${root_dir}*`}}), {
      total: 3,
      results: [
        {media_reference: {id: media_doodle.media_reference.id}},
        {media_reference: {id: media_cartoon.media_reference.id}},
        {media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })

    // test file glob queries
    ctx.assert.search_result(forager.media.search({query: {filepath: `*${media_generated_art.media_file.filename}`}}), {
      total: 1,
      results: [
        {media_reference: {id: media_generated_art.media_reference.id}}
      ]
    })

    // TODO support a decent "cd .." workflow. Currently its only easy to go "down" directories
  })
  */

  await ctx.subtest('media update', async () => {
    media_doodle = forager.media.update(media_doodle.media_reference.id, {}, ['cat'])
    ctx.assert.object_match(media_doodle, {
      tags: [{name: 'cat', color: 'hsl(0, 70%, 55%)'}]
    })

    // ensure we can add the same tag twice in an update without duplicating the tag
    media_doodle = forager.media.update(media_doodle.media_reference.id, {}, ['cat', 'doodle', 'medium:digital'])

    ctx.assert.object_match(media_doodle, {
      tags: [
        {name: 'digital', group: 'medium', color: 'hsl(131, 70%, 55%)' },
        {name: 'doodle', group: '', color: 'hsl(0, 70%, 55%)'},
        {name: 'cat', group: '', color: 'hsl(0, 70%, 55%)'},
      ]
    })
  })

  await ctx.subtest('media upsert', async () => {
    // test creating new media with upsert, creating new tag "animal:cat"
    const cronch = await forager.media.upsert(ctx.resources.media_files['cat_cronch.mp4'], {}, ['cat', 'animal:cat'])
    ctx.assert.object_match(cronch, {
      tags: [
        {name: 'cat', group: '', color: 'hsl(0, 70%, 55%)'},
        {name: 'cat', group: 'animal', color: 'hsl(36, 70%, 55%)' },
      ]
    })

    // test updating existing media with upsert
    ctx.assert.equals(media_cartoon.media_reference.title, 'Ed Edd Eddy Screengrab')
    media_cartoon = await forager.media.upsert(ctx.resources.media_files["ed-edd-eddy.png"], {title: 'Ed Sparrow'}, ['cartoon', 'wallpaper'])
    ctx.assert.equals(media_cartoon.media_reference.title, 'Ed Sparrow')
  })

  await ctx.subtest('media update remove tag', async () => {
    let cronch = forager.media.get({filepath: ctx.resources.media_files['cat_cronch.mp4'] })
    ctx.assert.object_match(cronch, {
      tags: [
        {name: 'cat', group: '', color: 'hsl(0, 70%, 55%)'},
        {name: 'cat', group: 'animal', color: 'hsl(36, 70%, 55%)' },
      ]
    })
    cronch = forager.media.update(cronch.media_reference.id, undefined, {remove: ['cat']})
    ctx.assert.object_match(cronch, {
      tags: [
        {name: 'cat', group: 'animal', color: 'hsl(36, 70%, 55%)' },
      ]
    })
  })

  await ctx.subtest('media delete', async () => {
    ctx.assert.search_result(forager.media.search(), {
      total: 4,
    })

    await forager.media.delete({media_reference_id: media_doodle.media_reference.id})

    ctx.assert.search_result(forager.media.search(), {
      total: 3,
      results: [
        {media_file: {filepath: ctx.resources.media_files["cat_cronch.mp4"]}},
        {media_reference: {title: 'Ed Sparrow'}},
        {media_reference: {title: 'Generated Art'}},
      ]
    })
  })
  forager.close()
})


test('search sort', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const media_generated_art = await forager.media.create(ctx.resources.media_files['koch.tif'], {source_created_at: new Date('1/1/2023') })
  const media_cartoon = await forager.media.create(ctx.resources.media_files["ed-edd-eddy.png"], {source_created_at: new Date('1/1/2024')})
  const media_doodle = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {source_created_at: new Date('1/1/2025')})

  await ctx.subtest('source_created_at sort order', () => {
    const page_1 = forager.media.search({sort_by: 'source_created_at', order: 'desc', limit: 2})
    ctx.assert.search_result(page_1, {
      results: [
        {media_reference: {id: media_doodle.media_reference.id}},
        {media_reference: {id: media_cartoon.media_reference.id}},
      ],
      total: 3
    })
    const page_2 = forager.media.search({sort_by: 'source_created_at', order: 'desc', limit: 2, cursor: page_1.cursor})
    ctx.assert.search_result(page_2, {
      results: [
        {media_reference: {id: media_generated_art.media_reference.id}},
      ],
      total: 3
    })
  })

  await ctx.subtest('created_at sort order', () => {
    // descending is the default sort order
    ctx.assert.search_result(forager.media.search({sort_by: 'created_at'}), {
      results: [
        {media_reference: {id: media_doodle.media_reference.id}},
        {media_reference: {id: media_cartoon.media_reference.id}},
        {media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })
    ctx.assert.search_result(forager.media.search({sort_by: 'created_at', order: 'asc'}), {
      results: [
        {media_reference: {id: media_generated_art.media_reference.id}},
        {media_reference: {id: media_cartoon.media_reference.id}},
        {media_reference: {id: media_doodle.media_reference.id}},
      ]
    })
    ctx.assert.search_result(forager.media.search({sort_by: 'created_at', order: 'desc'}), {
      results: [
        {media_reference: {id: media_doodle.media_reference.id}},
        {media_reference: {id: media_cartoon.media_reference.id}},
        {media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })

    // TODO add more variable sorting tests with view_count once we can update media references
  })
})

test('media search stars', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const art_1 = await forager.media.create(ctx.resources.media_files['koch.tif'], {stars: 0})

  ctx.assert.search_result(forager.media.search(), {
    total: 1
  })
  ctx.assert.search_result(forager.media.search({query: {stars: 1, stars_equality: "gte"}}), {
    total: 0
  })

  forager.media.update(art_1.media_reference.id, {stars: 2})

  ctx.assert.search_result(forager.media.search({query: {stars: 1, stars_equality: "gte"}}), {
    total: 1
  })
  ctx.assert.search_result(forager.media.search({query: {stars: 3, stars_equality: "gte"}}), {
    total: 0
  })
  ctx.assert.search_result(forager.media.search({query: {stars: 3, stars_equality: "eq"}}), {
    total: 0
  })
  ctx.assert.search_result(forager.media.search({query: {stars: 2, stars_equality: "eq"}}), {
    total: 1
  })
})


test('search group by', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  await forager.media.create(
    ctx.resources.media_files['koch.tif'],
    { title: 'Generated Art', stars: 2 },
    ['artist:andrew', 'generated', 'colors:black', 'wallpaper']
  )
  const ed_edd_eddy = await forager.media.create(
    ctx.resources.media_files["ed-edd-eddy.png"],
    {title: 'Ed Edd Eddy Screengrab'},
    ['artist:bob']
  )
  const cat_doodle = await forager.media.create(
    ctx.resources.media_files['cat_doodle.jpg'],
    {title: 'Cat Doodle'},
    ['artist:andrew']
  )
  const succulentsaur = await forager.media.create(
    ctx.resources.media_files['Succulentsaur.mp4'],
    {title: 'Succulentsaur'},
    ['artist:andrew']
  )

  const cat_cronch = await forager.media.create(
    ctx.resources.media_files['cat_cronch.mp4'],
    {title: 'Cat Video'},
    ['artist:alice']
  )

  // also add media without any tags that shouldnt show up in the group calls
  await forager.media.create(
    ctx.resources.media_files['blink.gif'],
    {},
    ['meme']
  )


  ctx.assert.group_result(
    forager.media.group({
      group_by: {tag_group: 'artist'}
    }),
    {
      total: 3,
      results: [
        { media_type: 'grouped', group: {value: 'andrew', count: 3} },
        { media_type: 'grouped', group: {value: 'bob', count: 1} },
        { media_type: 'grouped', group: {value: 'alice', count: 1} },
      ]
    }
  )

  await ctx.subtest('pagination', () => {
    const results_1_2 = forager.media.group({ group_by: {tag_group: 'artist'}, limit: 2})
    const results_3 = forager.media.group({ group_by: {tag_group: 'artist'}, limit: 2, cursor: results_1_2.cursor})
    ctx.assert.group_result(results_1_2, {
      total: 3,
      results: [
        { media_type: 'grouped', group: {value: 'andrew', count: 3} },
        { media_type: 'grouped', group: {value: 'bob', count: 1} },
      ]
    })
    ctx.assert.group_result(results_3, {
      total: 3,
      results: [
        { media_type: 'grouped', group: {value: 'alice', count: 1} },
      ]
    })
  })

  await ctx.subtest('with tag filter', () => {
    // assert adding a tag filter will strip out the other media with 'artist:' tags but no ':generated' tag
    ctx.assert.group_result(
      forager.media.group({
        group_by: {tag_group: 'artist'},
        query: { tags: ['generated']}
      }),
      {
        total: 1,
        results: [
          { media_type: 'grouped', group: {value: 'andrew', count: 1} },
        ]
      }
    )

    // assert this still works with multiple tags
    ctx.assert.group_result(
      forager.media.group({
        group_by: {tag_group: 'artist'},
        query: { tags: ['generated', 'colors:black']}
      }),
      {
        total: 1,
        results: [
          { media_type: 'grouped', group: {value: 'andrew', count: 1} },
        ]
      }
    )

    // assert that a non matching tag has no results
    ctx.assert.group_result(
      forager.media.group({
        group_by: {tag_group: 'artist'},
        query: { tags: ['meme']}
      }),
      {
        total: 0,
        results: []
      }
    )
  })

  await ctx.subtest('with grouped_media_limit', () => {
    const group_results = forager.media.group({
      group_by: {tag_group: 'artist'},
      grouped_media: {limit: 2},
    })
    ctx.assert.group_result(group_results, {
      total: 3,
      results: [
        {
          media_type: 'grouped',
          group: {
            value: 'andrew',
            count: 3,
            media: [
              {media_reference: {id: succulentsaur.media_reference.id}} as any,
              {media_reference: {id: cat_doodle.media_reference.id}} as any,
              // koch.tif is not present because we only asked for 2 media
            ]
          }
        },
        {
          media_type: 'grouped',
          group: {
            value: 'bob',
            count: 1,
            media: [
              {media_reference: {id: ed_edd_eddy.media_reference.id}} as any,
            ]
          }
        },
        {
          media_type: 'grouped',
          group: {
            value: 'alice',
            count: 1,
            media: [
              {media_reference: {id: cat_cronch.media_reference.id}} as any,
            ]
          }
        },
      ]
    })
  })
})


test('video media', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  let media_cronch = await forager.media.create(ctx.resources.media_files['cat_cronch.mp4'], {}, ['cat'])
  // ensure we have the exact right amount
  ctx.assert.equals(media_cronch.thumbnails.total, 18)
  ctx.assert.equals(media_cronch.thumbnails.results.length, 1)
  ctx.assert.equals(media_cronch.media_file.media_type, 'VIDEO')
  ctx.assert.equals(media_cronch.media_file.content_type, 'video/mp4')
  ctx.assert.equals(media_cronch.media_file.audio, true)
  ctx.assert.equals(media_cronch.thumbnails.results[0].media_timestamp, 0)
  ctx.assert.equals(path.basename(media_cronch.thumbnails.results[0].filepath), '0001.jpg')

  const media_art_timelapse = await forager.media.create(ctx.resources.media_files['Succulentsaur.mp4'], {}, ['art', 'timelapse'])
  ctx.assert.equals(media_art_timelapse.thumbnails.total, 18)
  ctx.assert.equals(media_art_timelapse.thumbnails.results.length, 1)
  ctx.assert.equals(media_art_timelapse.media_file.media_type, 'VIDEO')
  ctx.assert.equals(media_art_timelapse.media_file.content_type, 'video/mp4')
  ctx.assert.equals(media_art_timelapse.media_file.audio, false)
  ctx.assert.equals(media_art_timelapse.thumbnails.results[0].media_timestamp, 0)

  ctx.assert.search_result(forager.media.search({ query: {tags: ['cat']}}), {
    total: 1,
    results: [
      {
        thumbnails: {
          results: [
            {
              // we have special logic where asking for a singular timestamp will retrieve the most ideal preview of the media
              // in the future, we should make this a more holistic pattern
              media_timestamp: 0.766667,
            }
          ]
      }}
    ]
  })

  const media_cronch_thumbnails_all_search = forager.media.search({query: {tags: ['cat']}, thumbnail_limit: -1 })
  const media_cronch_thumbnails_all = media_cronch_thumbnails_all_search.results[0].thumbnails.results

  // just some basic assumptions about thumbnail timestamp distribution
  ctx.assert.equals(media_cronch_thumbnails_all.at(0)?.media_timestamp, 0)
  ctx.assert.equals(media_cronch_thumbnails_all.at(-1)?.media_timestamp! > 0, true)
  ctx.assert.equals(media_cronch_thumbnails_all.at(-1)?.media_timestamp! < media_cronch.media_file.duration, true)

  await ctx.subtest('keypoints', async () => {
    // media_cronch = await forager.media.update(media_cronch.media_reference.id, {}, [])
    // media_cronch = await forager.media.keypoints(media_cronch.media_reference.id, {'add': [{tag: 'crunch', timestamp: 1.4}]})
    const sound_byte_keypoint = await forager.keypoints.create({
      media_reference_id: media_cronch.media_reference.id,
      tag: 'sound_byte',
      start_timestamp: 5.200
    })
    ctx.assert.equals(sound_byte_keypoint.duration, 0)
    ctx.assert.equals(sound_byte_keypoint.media_timestamp, 5.2)

    const bite_keypoint = await forager.keypoints.create({
      media_reference_id: media_cronch.media_reference.id,
      tag: 'bite',
      start_timestamp: 4.700,
      end_timestamp: 5.100,
    })
    ctx.assert.equals(bite_keypoint.duration, 0.39999999999999947)
    // just documenting some weird floating point arithmetic here, if we use a non js language to ingest this keypoint data, things might not work as expected
    ctx.assert.equals(4.7 + 0.39999999999999947, 5.1)
    ctx.assert.equals(bite_keypoint.media_timestamp, 4.7)

    ctx.assert.equals(media_cronch.media_file.duration, 6.763)
    ctx.assert.list_partial(forager.media.get({media_reference_id: media_cronch.media_reference.id}).thumbnails.results, [
      { kind: "standard", media_timestamp: 0 },
      { kind: "standard", media_timestamp: 0.366667 },
      { kind: "standard", media_timestamp: 0.766667 },
      { kind: "standard", media_timestamp: 1.166667 },
      { kind: "standard", media_timestamp: 1.566667 },
      { kind: "standard", media_timestamp: 1.966667 },
      { kind: "standard", media_timestamp: 2.366667 },
      { kind: "standard", media_timestamp: 2.766667 },
      { kind: "standard", media_timestamp: 3.166667 },
      { kind: "standard", media_timestamp: 3.533333 },
      { kind: "standard", media_timestamp: 3.933333 },
      { kind: "standard", media_timestamp: 4.333333 },
      { kind: "keypoint", media_timestamp: 4.7 },
      { kind: "standard", media_timestamp: 4.733333 },
      { kind: "standard", media_timestamp: 5.133333 },
      { kind: "keypoint", media_timestamp: 5.2 },
      { kind: "standard", media_timestamp: 5.533333 },
      { kind: "standard", media_timestamp: 5.933333 },
      { kind: "standard", media_timestamp: 6.333333 },
      { kind: "standard", media_timestamp: 6.7 }
    ], (a, b) => a.media_timestamp - b.media_timestamp)

    // assert tags are created as well
    ctx.assert.list_partial(forager.media.get({media_reference_id: media_cronch.media_reference.id}).tags, [
      {name: 'bite'},
      {name: 'cat'},
      {name: 'sound_byte'},
    ], (a, b) => a.name.localeCompare(b.name))
  })

  await ctx.subtest('keypoint thumbnail file generation', async () => {
    const checksums = {
      cronch: '92a575edcc4c5b5b4dd2b3b0908aded951b8c022e0c85ecd6a5a78a4f30fefce',
    }
    const cronch_thumbnails_folder = path.join(forager.config.thumbnails.folder, '92', checksums.cronch)
    const read_thumbnails = await Array.fromAsync(fs.walk(cronch_thumbnails_folder))
    const read_thumbnails_sorted = read_thumbnails.map(entry => entry.path).sort((a,b) => a.localeCompare(b))
    ctx.assert.equals(read_thumbnails_sorted, [
      cronch_thumbnails_folder,
      path.join(cronch_thumbnails_folder, '0001.jpg'),
      path.join(cronch_thumbnails_folder, '0002.jpg'),
      path.join(cronch_thumbnails_folder, '0003.jpg'),
      path.join(cronch_thumbnails_folder, '0004.jpg'),
      path.join(cronch_thumbnails_folder, '0005.jpg'),
      path.join(cronch_thumbnails_folder, '0006.jpg'),
      path.join(cronch_thumbnails_folder, '0007.jpg'),
      path.join(cronch_thumbnails_folder, '0008.jpg'),
      path.join(cronch_thumbnails_folder, '0009.jpg'),
      path.join(cronch_thumbnails_folder, '0010.jpg'),
      path.join(cronch_thumbnails_folder, '0011.jpg'),
      path.join(cronch_thumbnails_folder, '0012.jpg'),
      path.join(cronch_thumbnails_folder, '0013.jpg'),
      path.join(cronch_thumbnails_folder, '0014.jpg'),
      path.join(cronch_thumbnails_folder, '0015.jpg'),
      path.join(cronch_thumbnails_folder, '0016.jpg'),
      path.join(cronch_thumbnails_folder, '0017.jpg'),
      path.join(cronch_thumbnails_folder, '0018.jpg'),
      path.join(cronch_thumbnails_folder, 'keypoints'),
      path.join(cronch_thumbnails_folder, 'keypoints', '0004.7.jpg'),
      path.join(cronch_thumbnails_folder, 'keypoints', '0005.2.jpg'),
    ])
  })

  await ctx.subtest('keypoints in search', async () => {
    // basic search, just ensure there are two files in the db
    ctx.assert.search_result(forager.media.search(), {
      total: 2,
      results: [
        {media_file: {filepath: ctx.resources.media_files["Succulentsaur.mp4"]}},
        {media_file: {filepath: ctx.resources.media_files["cat_cronch.mp4"]}},
      ]
    })

    // assert that when specifying a keypoint, we return the keypoint thumbnail
    ctx.assert.search_result(forager.media.search({query: {keypoint: 'bite'}}), {
      total: 1,
      results: [{
        media_file: {filepath: ctx.resources.media_files["cat_cronch.mp4"]},
        thumbnails: {
          total: 20,
          results: [
            {
              // assert that the first returned timestamp is the keypoint (this just makes previews nicer in the gui)
              media_timestamp: 4.7
            }
          ]
        }
      }]
    })

    // when we dont use keypoints in search, assert that we return the first timestamp thumbnail (default behavior)
    ctx.assert.search_result(forager.media.search({query: {tags: ['cat']}}), {
      results: [{
        thumbnails: {
          total: 20,
          results: [
            {
              // we have special logic where asking for a singular timestamp will retrieve the most ideal preview of the media
              // in the future, we should make this a more holistic pattern
              media_timestamp: 0.766667,
            }
          ]
        }
      }]
    })

  })

  await ctx.subtest('media deletes', async () => {
    // ensure that deletes work with video
    await forager.media.delete({media_reference_id: media_cronch.media_reference.id})
    media_cronch = await forager.media.create(ctx.resources.media_files['cat_cronch.mp4'], {}, ['cat'])

    ctx.assert.equals(media_cronch.thumbnails.total, 18)
    ctx.assert.equals(media_cronch.thumbnails.results.length, 1)
    ctx.assert.equals(media_cronch.media_file.media_type, 'VIDEO')
    ctx.assert.equals(media_cronch.media_file.content_type, 'video/mp4')
    ctx.assert.equals(media_cronch.thumbnails.results[0].media_timestamp, 0)
  })
})


test('search query.animated', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const media_generated_art = await forager.media.create(ctx.resources.media_files['koch.tif'])
  const media_cartoon = await forager.media.create(ctx.resources.media_files["ed-edd-eddy.png"])
  const media_gif = await forager.media.create(ctx.resources.media_files['blink.gif'])
  const media_doodle = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'])
  const media_video = await forager.media.create(ctx.resources.media_files['cat_cronch.mp4'])

  ctx.assert.search_result(forager.media.search(), {
    results: [
      {media_reference: {id: media_video.media_reference.id}, media_file: {animated: true}},
      {media_reference: {id: media_doodle.media_reference.id}, media_file: {animated: false}},
      {media_reference: {id: media_gif.media_reference.id}, media_file: {animated: true}},
      {media_reference: {id: media_cartoon.media_reference.id}, media_file: {animated: false}},
      {media_reference: {id: media_generated_art.media_reference.id}, media_file: {animated: false}},
    ]
  })

  // now lets prove that we only retrieve animated media with the query.animated filter
  ctx.assert.search_result(forager.media.search({query: {animated: true}}), {
    results: [
      {media_reference: {id: media_video.media_reference.id}, media_file: {animated: true}},
      {media_reference: {id: media_gif.media_reference.id}, media_file: {animated: true}},
    ]
  })
})

test('audio media', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  await forager.media.create(ctx.resources.media_files["music_snippet.mp3"])

  const results = forager.media.search()
  ctx.assert.search_result(results, {
    results: [
      {
        media_type: 'media_file',
        media_file: {
          filepath: ctx.resources.media_files['music_snippet.mp3'],
          audio: true,
          animated: false,
          duration: 6.96,
          framerate: 0,
          checksum: '1735a26d0182589686bfe0dd9ec4d1e73d82ef7ee95edec3ad6edc9aad48e8d5',
          media_type: 'AUDIO',
        }
      }
    ]
  })
  ctx.assert.equals(results.results[0].thumbnails.results.length, 1)
})


test('gif', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const media_gif = await forager.media.create(ctx.resources.media_files['blink.gif'])
  ctx.assert.equals(media_gif.media_file.codec, 'gif')
  ctx.assert.equals(media_gif.media_file.media_type, 'IMAGE')
  ctx.assert.equals(media_gif.media_file.animated, true)
  ctx.assert.equals(media_gif.media_file.duration, 3.18)

  const {thumbnails} = forager.media.get({media_reference_id: media_gif.media_reference.id})
  ctx.assert.list_partial(thumbnails.results, [
    { kind: "standard", media_timestamp: 0 },
    { kind: "standard", media_timestamp: 0.16 },
    { kind: "standard", media_timestamp: 0.32 },
    { kind: "standard", media_timestamp: 0.52 },
    { kind: "standard", media_timestamp: 0.68 },
    { kind: "standard", media_timestamp: 0.84 },
    { kind: "standard", media_timestamp: 1.04 },
    { kind: "standard", media_timestamp: 1.2 },
    { kind: "standard", media_timestamp: 1.36 },
    { kind: "standard", media_timestamp: 1.56 },
    { kind: "standard", media_timestamp: 1.72 },
    { kind: "standard", media_timestamp: 1.87 },
    { kind: "standard", media_timestamp: 2.08 },
    { kind: "standard", media_timestamp: 2.24 },
    { kind: "standard", media_timestamp: 2.4 },
    { kind: "standard", media_timestamp: 2.6 },
    { kind: "standard", media_timestamp: 2.76 },
    { kind: "standard", media_timestamp: 2.92 }
  ], (a, b) => a.media_timestamp - b.media_timestamp)
})


test('media series', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const media_generated_art = await forager.media.create(ctx.resources.media_files['koch.tif'], {title: 'Generated Art'}, [])
  const media_cartoon = await forager.media.create(ctx.resources.media_files["ed-edd-eddy.png"], {title: 'Ed Edd Eddy Screengrab'}, ['cartoon', 'wallpaper'])
  const media_doodle = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {title: 'Cat Doodle'}, [])

  let cool_art_series = forager.series.create({ title: 'cool art collection' })
  ctx.assert.equals(cool_art_series.media_reference.title, 'cool art collection')
  ctx.assert.equals(cool_art_series.media_reference.media_series_reference, true)
  ctx.assert.equals(cool_art_series.media_reference.media_series_length, 0)

  forager.series.add({
    series_id: cool_art_series.media_reference.id,
    media_reference_id: media_generated_art.media_reference.id,
    series_index: 0,
  })

  cool_art_series = forager.series.get({series_id: cool_art_series.media_reference.id})
  ctx.assert.equals(cool_art_series.media_reference.media_series_length, 1)

  forager.series.add({
    series_id: cool_art_series.media_reference.id,
    media_reference_id: media_cartoon.media_reference.id,
    series_index: 1,
  })

  cool_art_series = forager.series.get({series_id: cool_art_series.media_reference.id})
  ctx.assert.equals(cool_art_series.media_reference.media_series_length, 2)

  ctx.assert.search_result(forager.media.search({query: {series_id: cool_art_series.media_reference.id}}), {
    total: 2,
    results: [
      {media_reference: {title: 'Ed Edd Eddy Screengrab'}},
      {media_reference: {title: 'Generated Art'}},
    ]
  })

  await ctx.subtest('series crud operations', () => {
    // update
    ctx.assert.equals(cool_art_series.media_reference.title, 'cool art collection')
    cool_art_series = forager.series.update(cool_art_series.media_reference.id, {}, ['art'])
    ctx.assert.equals(cool_art_series.media_reference.title, 'cool art collection')
    ctx.assert.object_match(cool_art_series, {
      tags: [{name: 'art'}]
    })

    // ensure it appears in search
    ctx.assert.search_result(forager.media.search({query: {tags: ['art']}}), {
      total: 1,
      results: [
        {media_type: 'media_series', media_reference: {title: 'cool art collection'}},
      ]
    })
  })

  let doodle_series = forager.series.create({title: 'doodles'}, ['doodle_list'])
  await ctx.subtest('nested series', () => {
    forager.series.add({
      series_id: doodle_series.media_reference.id,
      media_reference_id: media_doodle.media_reference.id,
      series_index: 2,
    })
    // should we error when adding the same thing twice? I think we want to support this for things like ffmpeg-templates which might actually want a sequence containing duplicates
    forager.series.add({
      series_id: doodle_series.media_reference.id,
      media_reference_id: media_doodle.media_reference.id,
      series_index: 3,
    })

    doodle_series = forager.series.get({series_id: doodle_series.media_reference.id})
    ctx.assert.equals(cool_art_series.media_reference.media_series_length, 2)
    ctx.assert.search_result(forager.media.search({query: {series_id: doodle_series.media_reference.id}}), {
      total: 2,
      results: [
        {media_reference: {title: 'Cat Doodle'}},
        {media_reference: {title: 'Cat Doodle'}},
      ]
    })


    forager.series.add({series_id: cool_art_series.media_reference.id, media_reference_id: doodle_series.media_reference.id})
    cool_art_series = forager.series.get({series_id: cool_art_series.media_reference.id})
    ctx.assert.equals(cool_art_series.media_reference.media_series_length, 3)

    ctx.assert.search_result(forager.media.search({ query: {series_id: cool_art_series.media_reference.id} }), {
      total: 3,
      results: [
        {media_type: 'media_series', media_reference: {id: doodle_series.media_reference.id}},
        {media_type: 'media_file', media_reference: {id: media_cartoon.media_reference.id}},
        {media_type: 'media_file', media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })
  })

  await ctx.subtest('validation errors', () => {
    // getting a media reference that is not a media reference should error out
    ctx.assert.throws(() => forager.series.get({ series_id: media_doodle.media_reference.id }), errors.BadInputError)

    // a non existent series id should error out
    ctx.assert.throws(() => forager.series.get({ series_id: -1 }), errors.NotFoundError)

    // non existent should also error out using media search
    ctx.assert.throws(() => forager.media.search({ query: {series_id: -1} }), errors.NotFoundError)
    // non media series being referenced as a series_id should also error out using media search
    ctx.assert.throws(() => forager.media.search({ query: {series_id: media_doodle.media_reference.id} }), errors.BadInputError)
  })

  await ctx.subtest('thumbnails', () => {
    // first we need to grab the doodle series id
    const doodle_series_search = forager.media.search({query: {tags: ['doodle_list']}})
    ctx.assert.equals(doodle_series_search.total, 1)
    ctx.assert.equals(doodle_series_search.results[0].media_reference.title, 'doodles')
    const doodle_series = doodle_series_search.results[0]

    ctx.assert.search_result(forager.media.search({sort_by: 'created_at', order: 'asc', query: {series_id: cool_art_series.media_reference.id}, thumbnail_limit: -1}), {
      total: 3,
      results: [
        {
          media_type: 'media_file',
          media_reference: {id: media_generated_art.media_reference.id},
          thumbnails: {
            total: 1,
            results: [{media_file_id: media_generated_art.media_file.id}]
          }
        },
        {
          media_type: 'media_file',
          media_reference: {id: media_cartoon.media_reference.id},
          thumbnails: {
            total: 1,
            results: [{media_file_id: media_cartoon.media_file.id}]
          }
        },
        {
          media_type: 'media_series',
          media_reference: {id: doodle_series.media_reference.id},
          thumbnails: {
            total: 2,
            results: [
              {media_file_id: media_doodle.media_file.id},
              {media_file_id: media_doodle.media_file.id}
            ]
          }
        },
      ]
    })

    ctx.assert.object_match(forager.series.get({series_id: cool_art_series.media_reference.id}), {
      media_type: 'media_series',
      tags: [],
      thumbnails: { total: 2, results: [] },
    })
  })

  await ctx.subtest('search only series', () => {
    // try listing all the series
    ctx.assert.search_result(forager.media.search({query: {series: true}}), {
      total: 2,
      results: [
        {media_reference: {id: doodle_series.media_reference.id}},
        {media_reference: {id: cool_art_series.media_reference.id}},
      ]
    })

    // we can also add series_id here to look for series inside another series
    ctx.assert.search_result(forager.media.search({query: {series: true, series_id: cool_art_series.media_reference.id}}), {
      total: 1,
      results: [
        {media_reference: {id: doodle_series.media_reference.id}},
      ]
    })
  })
})


test('views', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  await forager.media.create(ctx.resources.media_files['koch.tif'], {title: 'Generated Art'}, [])
  const media_cartoon = await forager.media.create(ctx.resources.media_files["ed-edd-eddy.png"], {title: 'Ed Edd Eddy Screengrab'}, ['cartoon', 'wallpaper'])
  await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {title: 'Cat Doodle'}, [])

  let cartoon_view = forager.views.start({
    media_reference_id: media_cartoon.media_reference.id,
  })
  ctx.assert.object_match(cartoon_view, {
    media_reference_id: media_cartoon.media_reference.id,
    // a image view is fairly uninteresting. None of these will change over the lifetime of the view
    start_timestamp: 0,
    duration: 0,
    end_timestamp: null,
    num_loops: 0,
  })

  cartoon_view = forager.views.update({
    view_id: cartoon_view.id,
    view_duration: 5
  })
  ctx.assert.object_match(cartoon_view, {
    media_reference_id: media_cartoon.media_reference.id,
    start_timestamp: 0,
    duration: 5,
    end_timestamp: null,
    num_loops: 0,
  })

  // we cant set animated-only field on an image
  ctx.assert.throws(() => forager.views.update({
    view_id: cartoon_view.id,
    view_duration: 6,
    start_timestamp: 2,
  }), errors.BadInputError)
})


test('forager class', async ctx => {
  // assert that we error out when passing bad data to the forager class
  ctx.assert.throws(() => new Forager({foo: 'bar'} as any))
})
