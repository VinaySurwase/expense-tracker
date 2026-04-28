import { NextRequest } from "next/server";
import { createExpense, listExpenses } from "@/lib/expenses";
import { CreateExpenseSchema, ListExpensesSchema } from "@/lib/validation";
import { ZodError } from "zod";

/**
 * POST /api/expenses
 *
 * Creates a new expense. Supports idempotent retries via the Idempotency-Key header.
 *
 * - 201: Expense created successfully
 * - 200: Duplicate idempotency key — returns existing expense (not newly created)
 * - 422: Validation error
 * - 500: Internal server error (never leaks stack traces)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extract idempotency key from header, fall back to body field
    const idempotencyKey =
      req.headers.get("Idempotency-Key") || body.idempotencyKey || undefined;

    const parsed = CreateExpenseSchema.safeParse({ ...body, idempotencyKey });

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.issues },
        {
          status: 422,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { amount, category, description, date } = parsed.data;

    // Check if this is a duplicate idempotency key by comparing before/after
    const expense = createExpense({
      amount,
      category,
      description,
      date,
      idempotencyKey,
    });

    // If idempotency key was provided and the expense already existed,
    // the created_at will differ from "just now". We detect duplicates by
    // checking if the returned expense's id was generated in this call.
    // A simpler approach: if idempotencyKey is set, check if the record
    // existed before our insert. The repository already handles this —
    // if it returns an existing record, the HTTP status should be 200.
    //
    // We determine this by checking if the expense was just created:
    // If the created_at is within the last 2 seconds, it's new (201).
    // Otherwise it's an existing duplicate (200).
    let status = 201;
    if (idempotencyKey) {
      const createdAtMs = new Date(expense.created_at).getTime();
      const nowMs = Date.now();
      if (nowMs - createdAtMs > 2000) {
        status = 200; // Existing record returned
      }
    }

    return Response.json(expense, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Validation failed", details: error.issues },
        {
          status: 422,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.error("POST /api/expenses error:", error);
    return Response.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
        },
      }
    );
  }
}

/**
 * GET /api/expenses
 *
 * Lists expenses with optional category filter and sort direction.
 *
 * Query params:
 *   - category: string (optional) — filter by category
 *   - sort: "date_desc" | "date_asc" (default: "date_desc")
 *
 * Response:
 *   - 200: { expenses: Expense[], total: number }
 *   - 422: Bad query params
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawQuery: Record<string, string> = {};
    
    const category = searchParams.get("category");
    const sort = searchParams.get("sort");
    
    if (category) rawQuery.category = category;
    if (sort) rawQuery.sort = sort;

    const parsed = ListExpensesSchema.safeParse(rawQuery);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid query parameters", details: parsed.error.issues },
        {
          status: 422,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json",
          },
        }
      );
    }

    const expenses = listExpenses(parsed.data);
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Round total to 2 decimal places to avoid floating point artifacts
    const roundedTotal = Math.round(total * 100) / 100;

    return Response.json(
      { expenses, total: roundedTotal },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return Response.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
        },
      }
    );
  }
}
