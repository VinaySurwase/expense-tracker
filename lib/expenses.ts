import crypto from "crypto";
import { getDb, initDb } from "./db";
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

/** Row shape as returned by @libsql/client (amount in paise). */
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
    amount: Number(row.amount) / 100,
    category: String(row.category),
    description: String(row.description),
    date: String(row.date),
    created_at: String(row.created_at),
  };
}

/**
 * Create a new expense atomically.
 *
 * Uses INSERT ON CONFLICT to eliminate TOCTOU race conditions.
 *
 * @param input - The expense data with amount in decimal rupees.
 * @returns { expense, wasCreated } — wasCreated is false for idempotent duplicates.
 * @throws If amount <= 0.
 */
export async function createExpense(input: CreateExpenseInput): Promise<CreateExpenseResult> {
  if (input.amount <= 0) {
    throw new Error("Amount must be positive");
  }

  await initDb();
  const db = getDb();
  const id = crypto.randomUUID();
  const amountPaise = Math.round(input.amount * 100);
  const createdAt = new Date().toISOString();
  const description = input.description ?? "";
  const idempotencyKey = input.idempotencyKey ?? null;

  // If no idempotency key, just insert directly (no dedup needed).
  if (!idempotencyKey) {
    await db.execute({
      sql: `INSERT INTO expenses (id, amount, category, description, date, created_at, idempotency_key)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, amountPaise, input.category, description, input.date, createdAt, null],
    });

    const result = await db.execute({
      sql: "SELECT * FROM expenses WHERE id = ?",
      args: [id],
    });

    return { expense: rowToExpense(result.rows[0] as unknown as ExpenseRow), wasCreated: true };
  }

  // With idempotency key — use a transaction to atomically check + insert.
  const tx = await db.transaction("write");

  try {
    const insertResult = await tx.execute({
      sql: `INSERT INTO expenses (id, amount, category, description, date, created_at, idempotency_key)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(idempotency_key) DO NOTHING`,
      args: [id, amountPaise, input.category, description, input.date, createdAt, idempotencyKey],
    });

    const wasCreated = insertResult.rowsAffected > 0;

    // Always fetch by idempotency_key to return the canonical row.
    const selectResult = await tx.execute({
      sql: "SELECT * FROM expenses WHERE idempotency_key = ?",
      args: [idempotencyKey],
    });

    await tx.commit();

    return { expense: rowToExpense(selectResult.rows[0] as unknown as ExpenseRow), wasCreated };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

/**
 * List expenses with optional filtering, sorting, and pagination.
 */
export async function listExpenses(filters: ListFilters = {}): Promise<Expense[]> {
  await initDb();
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

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

  const result = await db.execute({ sql: query, args: params });
  return (result.rows as unknown as ExpenseRow[]).map(rowToExpense);
}

/**
 * Count total expenses matching filters (for pagination metadata).
 */
export async function countExpenses(filters: Pick<ListFilters, "category"> = {}): Promise<number> {
  await initDb();
  const db = getDb();
  const conditions: string[] = [];
  const params: string[] = [];

  if (filters.category) {
    conditions.push("category = ?");
    params.push(filters.category);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.execute({
    sql: `SELECT COUNT(*) as count FROM expenses ${where}`,
    args: params,
  });

  return Number(result.rows[0].count);
}

/**
 * Get the sum of all expenses matching filters.
 * Returns the sum in decimal rupees.
 */
export async function sumExpenses(filters: Pick<ListFilters, "category"> = {}): Promise<number> {
  await initDb();
  const db = getDb();
  const conditions: string[] = [];
  const params: string[] = [];

  if (filters.category) {
    conditions.push("category = ?");
    params.push(filters.category);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) as total FROM expenses ${where}`,
    args: params,
  });

  return Number(result.rows[0].total) / 100;
}
