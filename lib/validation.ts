import { z } from "zod";

/**
 * Zod validation schemas for API request payloads.
 *
 * These schemas serve as the single source of truth for input validation.
 * They run at the API boundary before any data reaches the repository layer.
 */

/** Schema for POST /api/expenses request body. */
export const CreateExpenseSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  category: z.string().min(1, "Category is required").max(100),
  description: z.string().max(500).default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  idempotencyKey: z.string().uuid().optional(),
});

/** Schema for GET /api/expenses query parameters. */
export const ListExpensesSchema = z.object({
  category: z.string().optional(),
  sort: z.enum(["date_desc", "date_asc"]).default("date_desc"),
});

/** Inferred types from schemas for type-safe usage. */
export type CreateExpensePayload = z.infer<typeof CreateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof ListExpensesSchema>;
