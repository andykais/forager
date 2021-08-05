import { MigrationStatement } from '../base'

export class Migration extends MigrationStatement {
  static VERSION = '0.1.1' as const

  call() {
    this.db.exec(`
      CREATE TABLE forager_new (
        singleton INTEGER NOT NULL UNIQUE DEFAULT 1 CHECK (singleton = 1), -- ensure only a single row can be inserted
        version FLOAT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO forager_new (singleton, version, name) SELECT * FROM forager;
      DROP TABLE forager;
      ALTER TABLE forager_new RENAME TO forager;
`)
  }
}
