# @forager/core


Application interface to the forager media manager database


## Requirements
- deno v2.2 (native node:sqlite)

## Usage
```ts
import { Forager } from '@forager/core'


using forager = new Forager({
  database: { folder: 'forager.db' },
  thumbnails: { folder: 'thumbnails' },
})
forager.init()


// add media directly into the database
forager.media.create('movie.mp4', {title: 'Gone With The Wind', source_created_at: new Date('1939/12/15')}, ['genre:drama'])
// or pass in a glob to import a whole directory
forager.filesystem.discover({path: './downloads/**/*.mp4', set: {['genre:drama']}})
// search for media in the database
forager.media.search({tags: ['genre:drama']})
```
