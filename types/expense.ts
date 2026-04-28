/**
 * Shared TypeScript types for expenses.
 *
 * Used by both the API layer and the frontend components.
 * This file is the single source of truth for the Expense shape.
 */

/** Predefined expense categories — shared between frontend and validation. */
export const CATEGORIES = [
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Entertainment",
  "Bills & Utilities",
  "Health & Fitness",
  "Travel",
  "Education",
  "Groceries",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** An expense as returned by the API (amount in decimal rupees). */
export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  created_at: string;
}

/** Input for creating a new expense. */
export interface CreateExpenseInput {
  amount: number;
  category: string;
  description?: string;
  date: string;
  idempotencyKey?: string;
}

/** Filters for listing expenses. */
export interface ListFilters {
  category?: string;
  sort?: "date_desc" | "date_asc";
  limit?: number;
  offset?: number;
}

/** Paginated response shape. */
export interface PaginatedExpenses {
  expenses: Expense[];
  total: number;
  count: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
