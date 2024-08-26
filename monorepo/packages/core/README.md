# @forager/core

A media manager database that integrates media in your existing file system with rich metadata, thumbnail generation and view tracking


## Usage
```ts
import { Forager } from '@forager/core'


const forager = new Forager({
  database_path: 'forager.db',
  thumbnail_folder: '~/.local/share/forager_thumbnails',
})
forager.init()


forager.media.create('movie.mp4', {title: 'Gone With The Wind', source_created_at: new Date('1939/12/15')}, ['genre:drama'])
```
