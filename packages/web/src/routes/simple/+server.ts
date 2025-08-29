import * as forager from '@forager/core'
// import * as sqlite from '@torm/sqlite'


export function GET(request) {
  const db = new forager.Forager({
    database: {
      folder: 'scratchwork/test',
    },
    thumbnails: {
      folder: 'scratchwork/test',
    }
  })
  db.init()
  console.log({db})
  return Response.json({'hello': 'world'})
}
