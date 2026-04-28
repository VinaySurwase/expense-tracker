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
 *   - If an idempotencyKey is provided and already exists in the DB,
 *     the existing row is returned WITHOUT creating a duplicate.
 *   - This makes createExpense safe to call multiple times with the same key.
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
 * Create a new expense.
 *
 * @param input - The expense data with amount in decimal rupees.
 * @returns The created (or existing, if idempotent duplicate) Expense.
 * @throws If amount <= 0.
 */
export function createExpense(input: CreateExpenseInput): Expense {
  if (input.amount <= 0) {
    throw new Error("Amount must be positive");
  }

  const db = getDb();
  const id = crypto.randomUUID();
  const amountPaise = Math.round(input.amount * 100);
  const createdAt = new Date().toISOString();
  const description = input.description ?? "";
  const idempotencyKey = input.idempotencyKey ?? null;

  // If an idempotency key is provided, check for an existing record first.
  if (idempotencyKey) {
    const existing = db
      .prepare("SELECT * FROM expenses WHERE idempotency_key = ?")
      .get(idempotencyKey) as ExpenseRow | undefined;

    if (existing) {
      return rowToExpense(existing);
    }
  }

  const stmt = db.prepare(`
    INSERT INTO expenses (id, amount, category, description, date, created_at, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, amountPaise, input.category, description, input.date, createdAt, idempotencyKey);

  // Read back the row we just inserted to return it consistently.
  const inserted = db
    .prepare("SELECT * FROM expenses WHERE id = ?")
    .get(id) as ExpenseRow;

  return rowToExpense(inserted);
}

/**
 * List expenses with optional filtering and sorting.
 *
 * @param filters - Optional category filter and sort direction.
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
  const query = `SELECT * FROM expenses ${where} ORDER BY date ${orderDir}, created_at ${orderDir}`;

  const rows = db.prepare(query).all(...params) as ExpenseRow[];
  return rows.map(rowToExpense);
}
