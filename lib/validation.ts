import { z } from "zod";

/**
 * Zod validation schemas for API request payloads.
 *
 * These schemas serve as the single source of truth for input validation.
 * They run at the API boundary before any data reaches the repository layer.
 */

/**
 * Custom date refinement — validates that the date string parses to a real date,
 * not just that it matches YYYY-MM-DD format (e.g., rejects "2024-02-31").
 */
function isValidDate(dateStr: string): boolean {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Schema for POST /api/expenses request body. */
export const CreateExpenseSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be positive")
    .max(99999999.99, "Amount exceeds maximum allowed value"),
  category: z.string().min(1, "Category is required").max(100),
  description: z.string().max(500).default(""),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .refine(isValidDate, "Date is not a valid calendar date"),
  idempotencyKey: z.string().uuid().optional(),
});

/** Schema for GET /api/expenses query parameters. */
export const ListExpensesSchema = z.object({
  category: z.string().optional(),
  sort: z.enum(["date_desc", "date_asc"]).default("date_desc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Inferred types from schemas for type-safe usage. */
export type CreateExpensePayload = z.infer<typeof CreateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof ListExpensesSchema>;
