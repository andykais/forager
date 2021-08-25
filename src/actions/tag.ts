import { Action } from './base'

class TagAction extends Action {
  public list() {
    return this.db.tag.select_all()
  }
}

export { TagAction }
