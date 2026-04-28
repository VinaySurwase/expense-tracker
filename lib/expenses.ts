import crypto from "crypto";
import { getDb } from "./db";
import type { Expense, CreateExpenseInput, ListFilters } from "@/types/expense";

/**
 * Data-access layer for expenses (repository pattern).
 *
 * Money conversion boundary:
 *   - Incoming amounts (decimal rupees) are converted to INTEGER paise on write.
 *   - Outgoing amounts (from DB) are converted back to decimal rupees on read.
 *   - This module is the ONLY place where this conversion happens.
 *
 * Idempotency:
 *   - Uses INSERT ... ON CONFLICT(idempotency_key) DO NOTHING to atomically
 *     prevent duplicate inserts — no TOCTOU race condition.
 *   - Returns { expense, wasCreated } so the caller can set the correct HTTP status.
 */

/** Row shape as stored in SQLite (amount in paise). */
interface ExpenseRow {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  created_at: string;
  idempotency_key: string | null;
}

/** Result of createExpense — includes whether the record was newly created. */
export interface CreateExpenseResult {
  expense: Expense;
  wasCreated: boolean;
}

/** Convert a DB row (paise) to an Expense (decimal rupees). */
function rowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    amount: row.amount / 100,
    category: row.category,
    description: row.description,
    date: row.date,
    created_at: row.created_at,
  };
}

/**
 * Create a new expense atomically.
 *
 * Uses a transaction with INSERT ON CONFLICT to eliminate TOCTOU race conditions.
 *
 * @param input - The expense data with amount in decimal rupees.
 * @returns { expense, wasCreated } — wasCreated is false for idempotent duplicates.
 * @throws If amount <= 0.
 */
export function createExpense(input: CreateExpenseInput): CreateExpenseResult {
  if (input.amount <= 0) {
    throw new Error("Amount must be positive");
  }

  const db = getDb();
  const id = crypto.randomUUID();
  const amountPaise = Math.round(input.amount * 100);
  const createdAt = new Date().toISOString();
  const description = input.description ?? "";
  const idempotencyKey = input.idempotencyKey ?? null;

  // If no idempotency key, just insert directly (no dedup needed).
  if (!idempotencyKey) {
    const stmt = db.prepare(`
      INSERT INTO expenses (id, amount, category, description, date, created_at, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, amountPaise, input.category, description, input.date, createdAt, null);

    const inserted = db
      .prepare("SELECT * FROM expenses WHERE id = ?")
      .get(id) as ExpenseRow;

    return { expense: rowToExpense(inserted), wasCreated: true };
  }

  // With idempotency key — use a transaction to atomically check + insert.
  // INSERT ON CONFLICT DO NOTHING prevents the TOCTOU race condition:
  // even if two requests arrive simultaneously, only one will insert.
  const result = db.transaction(() => {
    const insertStmt = db.prepare(`
      INSERT INTO expenses (id, amount, category, description, date, created_at, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(idempotency_key) DO NOTHING
    `);

    const info = insertStmt.run(
      id, amountPaise, input.category, description, input.date, createdAt, idempotencyKey
    );

    // info.changes === 1 means a new row was inserted.
    // info.changes === 0 means ON CONFLICT fired — row already existed.
    const wasCreated = info.changes === 1;

    // Always fetch by idempotency_key to return the canonical row.
    const row = db
      .prepare("SELECT * FROM expenses WHERE idempotency_key = ?")
      .get(idempotencyKey) as ExpenseRow;

    return { expense: rowToExpense(row), wasCreated };
  })();

  return result;
}

/**
 * List expenses with optional filtering, sorting, and pagination.
 *
 * @param filters - Optional category filter, sort direction, limit, and offset.
 * @returns Array of Expense objects with amounts in decimal rupees.
 */
export function listExpenses(filters: ListFilters = {}): Expense[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.category) {
    conditions.push("category = ?");
    params.push(filters.category);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderDir = filters.sort === "date_asc" ? "ASC" : "DESC";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const query = `SELECT * FROM expenses ${where} ORDER BY date ${orderDir}, created_at ${orderDir} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params) as ExpenseRow[];
  return rows.map(rowToExpense);
}

/**
 * Count total expenses matching filters (for pagination metadata).
 */
export function countExpenses(filters: Pick<ListFilters, "category"> = {}): number {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.category) {
    conditions.push("category = ?");
    params.push(filters.category);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const row = db.prepare(`SELECT COUNT(*) as count FROM expenses ${where}`).get(...params) as { count: number };
  return row.count;
}

/**
 * Get the sum of all expenses matching filters (for the total display).
 * Returns the sum in decimal rupees.
 */
export function sumExpenses(filters: Pick<ListFilters, "category"> = {}): number {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.category) {
    conditions.push("category = ?");
    params.push(filters.category);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses ${where}`).get(...params) as { total: number };
  return row.total / 100;
}
