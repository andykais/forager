import { Action } from './base'

class TagAction extends Action {
  public list() {
    return this.db.tag.select_all()
  }

  public get_tags(media_reference_id: number) {
    // return this.db.tag.
  }

}

export { TagAction }
