import { MigrationStatement } from '../base'

export class Migration extends MigrationStatement {
  static VERSION = '0.4.0' as const

  call() {
    this.db.exec(`ALTER TABLE tag ADD COLUMN description TEXT;`)
    this.db.exec(`ALTER TABLE tag ADD COLUMN metadata JSON;`)
  }
}
