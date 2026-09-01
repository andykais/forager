import {Rune} from '$lib/runes/rune.ts'
import type { MediaResponse, MediaFileResponse, MediaSeriesResponse, MediaGroupResponse, Forager, inputs, model_types } from '@forager/core'
import type { BaseController } from '$lib/base_controller.ts'


type AnyMediaResponse = MediaResponse | MediaGroupResponse

/**
 * The search/group params that produced a given result. These are threaded straight
 * through from the media list without favoring one search variant over another; the
 * rune that needs them (the grouped rune) narrows to the shape it requires.
 */
export type MediaSearchInput =
  | NonNullable<Parameters<Forager['media']['search']>[0]>
  | Parameters<Forager['media']['group']>[0]


interface State<M extends AnyMediaResponse> {
  media: M
  full_thumbnails: MediaResponse['thumbnails'] | undefined
}


/**
 * Base class for a single item rendered in the media list. The data getters and
 * mutations below are only meaningful for the media types that actually carry the
 * relevant data, so the base implementations error and each subclass overrides the
 * ones it supports.
 */
export abstract class MediaViewRune<M extends AnyMediaResponse = AnyMediaResponse> extends Rune {
  abstract media_type: M['media_type']
  state = $state<State<M>>()
  current_view: model_types.View | undefined

  protected constructor(client: BaseController['client'], media_response: M) {
    super(client)
    this.state = {
      media: media_response,
      full_thumbnails: undefined,
    }
  }

  get media(): M {
    return this.state!.media
  }

  set media(media: M) {
    this.state!.media = media
  }

  /**
   * Grouped results have no reference of their own, and the media under a group may not
   * be loaded yet, so this is optional on the base. Narrow on `media_type` (or use the
   * file/series runes directly) to get a guaranteed reference.
   */
  get media_reference(): model_types.MediaReference | undefined {
    throw new Error(`media_reference is not available on ${this.media_type} media`)
  }

  get tags(): model_types.Tag[] {
    throw new Error(`tags are not available on ${this.media_type} media`)
  }

  get media_file(): model_types.MediaFile {
    throw new Error(`media_file is not available on ${this.media_type} media`)
  }

  get thumbnails(): MediaResponse['thumbnails'] {
    throw new Error(`thumbnails are not available on ${this.media_type} media`)
  }

  get preview_thumbnail(): string | undefined {
    throw new Error(`preview_thumbnail is not available on ${this.media_type} media`)
  }

  // NOTE these are async so that the base implementations reject rather than throwing
  // synchronously past a caller's `.catch()`, which their declared types promise.
  public async update(media_info?: inputs.MediaInfo, tags?: inputs.MediaReferenceUpdateTags): Promise<void> {
    throw new Error(`update is not available on ${this.media_type} media`)
  }

  public async star(stars: number): Promise<void> {
    throw new Error(`star is not available on ${this.media_type} media`)
  }

  public async add_view(): Promise<void> {
    throw new Error(`add_view is not available on ${this.media_type} media`)
  }

  public async load_detailed_view(): Promise<void> {
    throw new Error(`load_detailed_view is not available on ${this.media_type} media`)
  }

  public img_fit_classes(): string {
    throw new Error(`img_fit_classes is not available on ${this.media_type} media`)
  }

  static create(client: BaseController['client'], media_response: AnyMediaResponse, search_params: MediaSearchInput) {
    if (media_response.media_type === 'media_file') {
      return new MediaFileRune(client, media_response)
    } else if (media_response.media_type === 'media_series') {
      return new MediaSeriesRune(client, media_response)
    } else if (media_response.media_type === 'grouped') {
      return new MediaGroupRune(client, media_response, search_params)
    } else {
      throw new Error(`Unexpected media_response ${JSON.stringify(media_response)}`)
    }
  }
}


/** Shared behavior for runes backed by a concrete media reference (files and series). */
abstract class MediaReferenceRune<M extends MediaFileResponse | MediaSeriesResponse> extends MediaViewRune<M> {
  override get media_reference(): model_types.MediaReference {
    return this.media.media_reference
  }

  override get tags(): model_types.Tag[] {
    return this.media.tags
  }

  override get thumbnails(): MediaResponse['thumbnails'] {
    return this.media.thumbnails
  }

  override get preview_thumbnail(): string | undefined {
    return `/files/thumbnail/${this.media.thumbnails.results.at(0)?.id}`
  }

  public override async add_view() {
    // TODO track view and update it as a video loops, or as an image has stayed open for a while
    const view_response = await this.client.forager.views.start({media_reference_id: this.media_reference.id })
    this.current_view = view_response.view
    this.media_reference.view_count = view_response.media_reference.view_count
  }
}


export class MediaFileRune extends MediaReferenceRune<MediaFileResponse> {
  media_type = 'media_file' as const

  override get media_file(): model_types.MediaFile {
    return this.media.media_file
  }

  public override async update(media_info?: inputs.MediaInfo, tags?: inputs.MediaReferenceUpdateTags) {
    const updated = await this.client.forager.media.update(
      this.media_reference.id,
      media_info,
      tags
    )
    this.media = updated
  }

  public override async star(stars: number) {
    const updated = await this.client.forager.media.update(
      this.media_reference.id,
      {stars}
    )
    this.media = updated
  }

  public override async load_detailed_view() {
    if (this.state!.full_thumbnails) return
    const result = await this.client.forager.media.get({media_reference_id: this.media_reference.id })
    this.state!.full_thumbnails = result.thumbnails
  }

  public override img_fit_classes() {
    if ((this.media_file.width ?? 0) > (this.media_file.height ?? 0)) {
      // its long edge is wide
      return "w-full"
    } else {
      // its long edge is tall
      return "h-full"
    }
  }
}


export class MediaSeriesRune extends MediaReferenceRune<MediaSeriesResponse> {
  media_type = 'media_series' as const

  public override async load_detailed_view() {
    if (this.state!.full_thumbnails) return
    const series = await this.client.forager.series.get({series_id: this.media_reference.id })
    this.state!.full_thumbnails = series.thumbnails
    // TODO attach series items
    // const series_items = await this.client.forager.media.search({query: {series_id: this.media_reference.id }})
  }

  public override img_fit_classes() {
    console.warn(`media series img fit functions are not implemented`)
    return "w-full"
  }
}


interface GroupState {
  media_list: MediaResponse[]
}
export class MediaGroupRune extends MediaViewRune<MediaGroupResponse> {
  media_type = 'grouped' as const
  grouped_state = $state<GroupState>({
    media_list: []
  })

  constructor(client: BaseController['client'], media_response: MediaGroupResponse, search_params: MediaSearchInput) {
    super(client, media_response)

    if (!('group_by' in search_params) || search_params.group_by?.tag_group === undefined) {
      throw new Error(`unexpected search group`)
    }

    const {group_by, cursor, ...merged_search_params} = search_params
    merged_search_params.query = {...merged_search_params.query}
    merged_search_params.query.tags = merged_search_params.query.tags
        ? [...merged_search_params.query.tags]
        : []
    const tag = `${group_by.tag_group}:${media_response.group.value}`
    merged_search_params.query.tags.push(tag)
    if (merged_search_params.sort_by === 'count') {
      merged_search_params.sort_by = 'created_at'
    }
    merged_search_params.limit = 1 // TODO until we implement a filmstrip render, we only need one image

    // `merged_search_params` is the group-by query with its grouping fields removed, so
    // it maps onto a standard media search that fetches the media under this group.
    this.client.forager.media.search(merged_search_params as inputs.PaginatedSearch)
      .then(result => {
        this.grouped_state.media_list = result.results
      })
  }

  get group_metadata() {
    return this.media.group
  }

  /**
   * The media standing in for this group. Core supplies it on `group.media` when the
   * search asks for `grouped_media`, otherwise we fall back to the list this rune
   * fetches itself. Undefined until one of those has loaded.
   */
  get #representative_media(): MediaResponse | undefined {
    return this.media.group.media?.at(0) ?? this.grouped_state.media_list.at(0)
  }

  override get media_reference(): model_types.MediaReference | undefined {
    return this.#representative_media?.media_reference
  }

  override get preview_thumbnail(): string | undefined {
    const media_entry = this.#representative_media
    if (media_entry) {
      return `/files/thumbnail/${media_entry.thumbnails.results[0].id}`
    }
    return undefined
  }

  public override img_fit_classes() {
    const media = this.#representative_media
    if (media === undefined) {
      return "w-full h-full"
    } else if (media.media_type === 'media_file' && (media.media_file.width ?? 0) > (media.media_file.height ?? 0)) {
      // its long edge is wide
      return "w-full"
    } else {
      // its long edge is tall
      return "h-full"
    }
  }
}

export type AnyMediaViewRune = MediaFileRune | MediaSeriesRune | MediaGroupRune
