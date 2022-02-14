import { MigrationStatement } from '../base'

export class Migration extends MigrationStatement {
  static VERSION = '0.5.1' as const

  call() {
    this.db.exec(`DROP INDEX media_tag;`)
  }
}
