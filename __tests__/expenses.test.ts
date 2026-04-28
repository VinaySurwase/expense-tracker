/**
 * Unit tests for the expense data-access layer (lib/expenses.ts).
 *
 * Uses an in-memory libSQL database for isolation — each test gets
 * a fresh database to prevent cross-test contamination.
 */

import { createExpense, listExpenses, countExpenses, sumExpenses } from "@/lib/expenses";
import { getDb, closeDb } from "@/lib/db";

// Use a temp file database for tests (libsql shared-cache not supported).
beforeAll(async () => {
  process.env.TURSO_DATABASE_URL = "file:/tmp/test-expenses.db";
  const { initDb } = await import("@/lib/db");
  await initDb();
});

afterEach(async () => {
  // Clear all data between tests for isolation
  const db = getDb();
  await db.execute("DELETE FROM expenses");
});

afterAll(async () => {
  closeDb();
  // Clean up temp file
  const fs = await import("fs");
  try { fs.unlinkSync("/tmp/test-expenses.db"); } catch { /* ignore */ }
});

describe("createExpense", () => {
  it("stores amount in paise correctly", async () => {
    const { expense } = await createExpense({
      amount: 49.99,
      category: "Food & Dining",
      date: "2024-01-15",
    });

    expect(expense.amount).toBe(49.99);

    // Verify the DB stores it as paise (integer)
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT amount FROM expenses WHERE id = ?",
      args: [expense.id],
    });
    expect(Number(result.rows[0].amount)).toBe(4999);
  });

  it("returns wasCreated=true for new records", async () => {
    const { wasCreated } = await createExpense({
      amount: 100,
      category: "Other",
      date: "2024-01-01",
    });
    expect(wasCreated).toBe(true);
  });

  it("returns amount as decimal rupees", async () => {
    const { expense } = await createExpense({
      amount: 100.5,
      category: "Transportation",
      date: "2024-02-20",
    });

    expect(expense.amount).toBe(100.5);
    expect(typeof expense.amount).toBe("number");
  });

  it("with same idempotency key returns existing record and wasCreated=false", async () => {
    const key = "550e8400-e29b-41d4-a716-446655440000";

    const first = await createExpense({
      amount: 25.0,
      category: "Shopping",
      date: "2024-03-01",
      idempotencyKey: key,
    });

    const second = await createExpense({
      amount: 999.0,
      category: "Different",
      date: "2024-03-02",
      idempotencyKey: key,
    });

    // Should return the FIRST record, not create a new one
    expect(second.expense.id).toBe(first.expense.id);
    expect(second.expense.amount).toBe(25.0);
    expect(second.expense.category).toBe("Shopping");
    expect(second.wasCreated).toBe(false);
    expect(first.wasCreated).toBe(true);
  });

  it("with negative amount throws", async () => {
    await expect(
      createExpense({
        amount: -10,
        category: "Food & Dining",
        date: "2024-01-01",
      })
    ).rejects.toThrow("Amount must be positive");
  });

  it("with zero amount throws", async () => {
    await expect(
      createExpense({
        amount: 0,
        category: "Food & Dining",
        date: "2024-01-01",
      })
    ).rejects.toThrow("Amount must be positive");
  });

  it("sets created_at automatically", async () => {
    const before = new Date().toISOString();
    const { expense } = await createExpense({
      amount: 10,
      category: "Other",
      date: "2024-01-01",
    });
    const after = new Date().toISOString();

    expect(expense.created_at >= before).toBe(true);
    expect(expense.created_at <= after).toBe(true);
  });

  it("handles description correctly", async () => {
    const { expense } = await createExpense({
      amount: 15,
      category: "Food & Dining",
      description: "Lunch at cafe",
      date: "2024-01-01",
    });

    expect(expense.description).toBe("Lunch at cafe");
  });

  it("defaults description to empty string", async () => {
    const { expense } = await createExpense({
      amount: 15,
      category: "Food & Dining",
      date: "2024-01-01",
    });

    expect(expense.description).toBe("");
  });
});

describe("listExpenses", () => {
  beforeEach(async () => {
    await createExpense({ amount: 100, category: "Food & Dining", date: "2024-01-15" });
    await createExpense({ amount: 200, category: "Transportation", date: "2024-01-20" });
    await createExpense({ amount: 50, category: "Food & Dining", date: "2024-01-10" });
    await createExpense({ amount: 300, category: "Shopping", date: "2024-01-25" });
  });

  it("returns expenses with default limit", async () => {
    const expenses = await listExpenses();
    expect(expenses).toHaveLength(4);
  });

  it("filters by category", async () => {
    const expenses = await listExpenses({ category: "Food & Dining" });
    expect(expenses).toHaveLength(2);
    expect(expenses.every((e) => e.category === "Food & Dining")).toBe(true);
  });

  it("sorts by date descending by default", async () => {
    const expenses = await listExpenses();
    expect(expenses[0].date).toBe("2024-01-25");
    expect(expenses[expenses.length - 1].date).toBe("2024-01-10");
  });

  it("sorts by date ascending when requested", async () => {
    const expenses = await listExpenses({ sort: "date_asc" });
    expect(expenses[0].date).toBe("2024-01-10");
    expect(expenses[expenses.length - 1].date).toBe("2024-01-25");
  });

  it("respects limit parameter", async () => {
    const expenses = await listExpenses({ limit: 2 });
    expect(expenses).toHaveLength(2);
  });

  it("respects offset parameter", async () => {
    const expenses = await listExpenses({ limit: 2, offset: 2 });
    expect(expenses).toHaveLength(2);
    expect(expenses[0].date).toBe("2024-01-15");
  });

  it("returns empty array when category has no matches", async () => {
    const expenses = await listExpenses({ category: "Nonexistent" });
    expect(expenses).toHaveLength(0);
  });
});

describe("countExpenses", () => {
  beforeEach(async () => {
    await createExpense({ amount: 100, category: "Food & Dining", date: "2024-01-15" });
    await createExpense({ amount: 200, category: "Transportation", date: "2024-01-20" });
    await createExpense({ amount: 50, category: "Food & Dining", date: "2024-01-10" });
  });

  it("counts all expenses", async () => {
    expect(await countExpenses()).toBe(3);
  });

  it("counts by category", async () => {
    expect(await countExpenses({ category: "Food & Dining" })).toBe(2);
    expect(await countExpenses({ category: "Transportation" })).toBe(1);
  });
});

describe("sumExpenses", () => {
  beforeEach(async () => {
    await createExpense({ amount: 100, category: "Food & Dining", date: "2024-01-15" });
    await createExpense({ amount: 200.50, category: "Transportation", date: "2024-01-20" });
  });

  it("sums all expenses in decimal rupees", async () => {
    expect(await sumExpenses()).toBe(300.5);
  });

  it("sums by category", async () => {
    expect(await sumExpenses({ category: "Food & Dining" })).toBe(100);
  });

  it("returns 0 for empty result", async () => {
    expect(await sumExpenses({ category: "Nonexistent" })).toBe(0);
  });
});
