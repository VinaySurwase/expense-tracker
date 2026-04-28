/**
 * Shared TypeScript types for the Expense Tracker.
 *
 * Money convention:
 *   - In the database, amounts are stored as INTEGER paise (1 rupee = 100 paise).
 *   - In the API layer and UI, amounts are expressed as decimal rupees (e.g. 49.99).
 *   - Conversion happens at the repository boundary — callers never touch paise.
 */

/** Expense as returned by the API and consumed by the UI. */
export interface Expense {
  id: string;
  /** Decimal rupees (e.g. 49.99). Never paise at this layer. */
  amount: number;
  category: string;
  description: string;
  /** ISO 8601 date string: YYYY-MM-DD */
  date: string;
  /** ISO 8601 datetime string */
  created_at: string;
}

/** Input shape accepted by the repository's createExpense function. */
export interface CreateExpenseInput {
  /** Decimal rupees — will be converted to paise on write. */
  amount: number;
  category: string;
  description?: string;
  /** ISO 8601 date: YYYY-MM-DD */
  date: string;
  /** Optional UUID for idempotent inserts. */
  idempotencyKey?: string;
}

/** Filters accepted by listExpenses. */
export interface ListFilters {
  category?: string;
  sort?: "date_desc" | "date_asc";
}

/** Shape of the GET /api/expenses response. */
export interface ListExpensesResponse {
  expenses: Expense[];
  total: number;
}

/** Standard API error response. */
export interface ApiErrorResponse {
  error: string;
  details?: unknown;
}
