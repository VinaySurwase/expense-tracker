import { createClient, type Client } from "@libsql/client";

/**
 * Database client singleton — Turso (hosted SQLite).
 *
 * Design decisions:
 *   - Uses @libsql/client which supports both local SQLite files and
 *     Turso hosted databases via the same API.
 *   - Local dev: uses file:expenses.db (same as before, zero config).
 *   - Vercel/Production: uses TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 *   - Schema is created idempotently on first connection.
 *
 * Adapter pattern: This module is the single point of contact with the database.
 * All consumers depend on the Expense type, not on the database driver.
 */

let _client: Client | null = null;
let _initialized = false;

/**
 * Returns the singleton database client.
 */
export function getDb(): Client {
  if (_client) return _client;

  // TURSO_DATABASE_URL for hosted (Vercel), file: URL for local dev.
  // Tests set TURSO_DATABASE_URL to "file::memory:" for in-memory isolation.
  const url = process.env.TURSO_DATABASE_URL || "file:expenses.db";
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

  _client = createClient({ url, authToken });
  return _client;
}

/**
 * Initialize the database schema. Must be called before first query.
 * Idempotent — safe to call multiple times.
 */
export async function initDb(): Promise<void> {
  if (_initialized) return;

  const db = getDb();

  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS expenses (
        id              TEXT PRIMARY KEY,
        amount          INTEGER NOT NULL CHECK(amount > 0),
        category        TEXT NOT NULL,
        description     TEXT NOT NULL DEFAULT '',
        date            TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        idempotency_key TEXT UNIQUE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)`,
    ],
    "write"
  );

  _initialized = true;
}

/**
 * Close the database connection. Useful for tests and graceful shutdown.
 */
export function closeDb(): void {
  if (_client) {
    _client.close();
    _client = null;
    _initialized = false;
  }
}
