import Database from "better-sqlite3";
import path from "path";

/**
 * SQLite database singleton.
 *
 * Design decisions:
 *   - Uses better-sqlite3 for synchronous, zero-dependency SQLite access.
 *   - DB file path is configurable via the DB_PATH environment variable,
 *     defaulting to ./expenses.db in the project root.
 *   - Schema is created idempotently on first connection (CREATE IF NOT EXISTS).
 *   - WAL journal mode for better concurrent read performance.
 *
 * Adapter pattern: This module is the single point of contact with SQLite.
 * To swap to PostgreSQL or another backend, only this file and lib/expenses.ts
 * need to change. All consumers depend on the Expense type, not on SQLite.
 */

let _db: Database.Database | null = null;

/**
 * Returns the singleton database instance, initialising the schema on first call.
 */
export function getDb(): Database.Database {
  if (_db) return _db;

  // Read DB_PATH lazily so tests can override it before first call
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "expenses.db");
  _db = new Database(dbPath);

  // Enable WAL mode for better read concurrency
  _db.pragma("journal_mode = WAL");

  // Create schema idempotently
  _db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id              TEXT PRIMARY KEY,
      amount          INTEGER NOT NULL CHECK(amount > 0),
      category        TEXT NOT NULL,
      description     TEXT NOT NULL DEFAULT '',
      date            TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      idempotency_key TEXT UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
  `);

  return _db;
}

/**
 * Close the database connection. Useful for tests and graceful shutdown.
 */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
