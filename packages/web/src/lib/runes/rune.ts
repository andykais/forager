import type { BaseController } from '$lib/base_controller.ts'
import { resolve_connection, type Connection } from '$lib/connection.ts'

export class Rune {
  protected connection: Connection

  public constructor(
    protected client: BaseController['client'],
    connection: Connection = resolve_connection(),
  ) {
    this.connection = connection
  }

  /** URL for streaming a media file. Mirrors `BaseController.media_url`. */
  protected media_url(media_reference_id: number): string {
    return `${this.connection.base_url}/files/media_file/${media_reference_id}`
  }

  /** URL for a thumbnail. Mirrors `BaseController.thumbnail_url`. */
  protected thumbnail_url(thumbnail_id: number | undefined, index: number = 0): string {
    const base = `${this.connection.base_url}/files/thumbnail/${thumbnail_id}`
    return index === 0 ? base : `${base}?index=${index}`
  }
}
