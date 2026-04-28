import { NextRequest } from "next/server";
import { createExpense, listExpenses, countExpenses, sumExpenses } from "@/lib/expenses";
import { CreateExpenseSchema, ListExpensesSchema } from "@/lib/validation";
import { ZodError } from "zod";

/**
 * Helper to create consistent JSON responses with standard headers.
 * Eliminates repeated header boilerplate across route handlers.
 */
function jsonResponse(data: unknown, status: number) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

/**
 * Simple in-memory rate limiter.
 *
 * Tracks request counts per IP within a sliding window.
 * Resets every WINDOW_MS. For production, use Redis-backed rate limiting.
 */
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// Clean up stale rate limit entries every 5 minutes (skip in test env)
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
      if (now > entry.resetAt) {
        rateLimitMap.delete(ip);
      }
    }
  }, 5 * 60_000);
}

/**
 * POST /api/expenses
 *
 * Creates a new expense. Supports idempotent retries via the Idempotency-Key header.
 *
 * - 201: Expense created successfully
 * - 200: Duplicate idempotency key — returns existing expense
 * - 400: Malformed JSON body
 * - 422: Validation error
 * - 429: Rate limit exceeded
 * - 500: Internal server error (never leaks stack traces)
 */
export async function POST(req: NextRequest) {
  // Rate limit check
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return jsonResponse(
      { error: "Too many requests. Please try again later." },
      429
    );
  }

  // Parse JSON body with specific error for malformed JSON
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  try {
    // Extract idempotency key from header, fall back to body field
    const rawBody = body as Record<string, unknown>;
    const idempotencyKey: string | undefined =
      req.headers.get("Idempotency-Key") ||
      (typeof rawBody?.idempotencyKey === "string" ? rawBody.idempotencyKey : undefined);

    const parsed = CreateExpenseSchema.safeParse({
      ...(body as Record<string, unknown>),
      idempotencyKey,
    });

    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", details: parsed.error.issues },
        422
      );
    }

    const { amount, category, description, date } = parsed.data;

    const { expense, wasCreated } = await createExpense({
      amount,
      category,
      description,
      date,
      idempotencyKey,
    });

    // wasCreated is true for new records (201), false for idempotent duplicates (200)
    return jsonResponse(expense, wasCreated ? 201 : 200);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonResponse(
        { error: "Validation failed", details: error.issues },
        422
      );
    }

    console.error("POST /api/expenses error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}

/**
 * GET /api/expenses
 *
 * Lists expenses with optional category filter, sort direction, and pagination.
 *
 * Query params:
 *   - category: string (optional) — filter by category
 *   - sort: "date_desc" | "date_asc" (default: "date_desc")
 *   - limit: number (1-100, default: 50)
 *   - offset: number (>= 0, default: 0)
 *
 * Response:
 *   - 200: { expenses, total, count, limit, offset, hasMore }
 *   - 422: Bad query params
 *   - 429: Rate limit exceeded
 */
export async function GET(req: NextRequest) {
  // Rate limit check
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return jsonResponse(
      { error: "Too many requests. Please try again later." },
      429
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const rawQuery: Record<string, string> = {};

    const category = searchParams.get("category");
    const sort = searchParams.get("sort");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    if (category) rawQuery.category = category;
    if (sort) rawQuery.sort = sort;
    if (limit) rawQuery.limit = limit;
    if (offset) rawQuery.offset = offset;

    const parsed = ListExpensesSchema.safeParse(rawQuery);

    if (!parsed.success) {
      return jsonResponse(
        { error: "Invalid query parameters", details: parsed.error.issues },
        422
      );
    }

    const expenses = await listExpenses(parsed.data);
    const count = await countExpenses({ category: parsed.data.category });
    const total = await sumExpenses({ category: parsed.data.category });

    // Round total to 2 decimal places to avoid floating point artifacts
    const roundedTotal = Math.round(total * 100) / 100;

    return jsonResponse({
      expenses,
      total: roundedTotal,
      count,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      hasMore: parsed.data.offset + expenses.length < count,
    }, 200);
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}
