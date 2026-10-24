import { type Forager, type MediaResponse, type MediaGroupResponse, type model_types, errors } from '@forager/core'


/**
 * Compact representations of forager responses. Mcp responses are read by a language model, so ids, colors, and other fields only useful to a gui are dropped to save context.
 */

type PaginatedResult<T> = model_types.PaginatedResult<T>
type TagSearchResultItem = ReturnType<Forager['tag']['search']>['results'][number]

export interface Page<T> {
  total: number
  /** Pass this back as `cursor` to fetch the next page. null when there are no more results */
  next_cursor: string | null
  results: T[]
}


export function encode_cursor(cursor: PaginatedResult<unknown>['cursor']): string | null {
  if (cursor === undefined) return null
  return btoa(JSON.stringify(cursor))
}


export function decode_cursor(cursor: string | undefined): PaginatedResult<unknown>['cursor'] {
  if (cursor === undefined) return undefined
  try {
    return JSON.parse(atob(cursor))
  } catch {
    throw new errors.BadInputError(`Invalid cursor "${cursor}". Use the next_cursor value from a previous response`)
  }
}


export function format_page<T, R>(page: PaginatedResult<T>, format: (result: T) => R): Page<R> {
  return {
    total: page.total,
    next_cursor: encode_cursor(page.cursor),
    results: page.results.map(format),
  }
}


export function format_media(media: MediaResponse & {series_index?: number}) {
  const { media_reference } = media
  const formatted = {
    media_reference_id: media_reference.id,
    series_index: media.series_index,
    title: media_reference.title,
    description: media_reference.description,
    stars: media_reference.stars,
    view_count: media_reference.view_count,
    source_url: media_reference.source_url,
    source_created_at: media_reference.source_created_at,
    metadata: media_reference.metadata,
    editors: media_reference.editors,
    created_at: media_reference.created_at,
    updated_at: media_reference.updated_at,
    tags: media.tags.map(tag => tag.slug),
    thumbnails: media.thumbnails.results.map(thumbnail => thumbnail.filepath),
  }

  if (media.media_type === 'media_series') {
    return {
      kind: 'media_series' as const,
      media_series_name: media_reference.media_series_name,
      media_series_length: media_reference.media_series_length,
      ...formatted,
    }
  } else {
    const { media_file } = media
    return {
      kind: 'media_file' as const,
      filepath: media_file.filepath,
      media_type: media_file.media_type,
      content_type: media_file.content_type,
      codec: media_file.codec,
      width: media_file.width,
      height: media_file.height,
      duration: media_file.duration,
      animated: media_file.animated,
      audio: media_file.audio,
      file_size_bytes: media_file.file_size_bytes,
      ...formatted,
    }
  }
}


export function format_group(tag_group: string, grouped: MediaGroupResponse) {
  const { value, count, media } = grouped.group
  return {
    tag: tag_group ? `${tag_group}:${value}` : value,
    count,
    media: media?.map(format_media),
  }
}


export function format_tag(tag: TagSearchResultItem) {
  return {
    tag: tag.slug,
    description: tag.description,
    media_reference_count: tag.media_reference_count,
    unread_media_reference_count: tag.unread_media_reference_count,
    alias_count: tag.alias_count,
    parent_count: tag.parent_count,
  }
}
