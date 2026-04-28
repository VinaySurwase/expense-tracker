/**
 * Unit tests for the expense data-access layer (lib/expenses.ts).
 *
 * Uses an in-memory SQLite database for isolation — each test gets
 * a fresh database to prevent cross-test contamination.
 */

import { createExpense, listExpenses, countExpenses, sumExpenses } from "@/lib/expenses";
import { getDb, closeDb } from "@/lib/db";

// Override the DB path to use an in-memory database for tests.
beforeAll(() => {
  process.env.DB_PATH = ":memory:";
});

afterEach(() => {
  closeDb();
});

afterAll(() => {
  closeDb();
});

describe("createExpense", () => {
  it("stores amount in paise correctly", () => {
    const { expense } = createExpense({
      amount: 49.99,
      category: "Food & Dining",
      date: "2024-01-15",
    });

    expect(expense.amount).toBe(49.99);

    // Verify the DB stores it as paise (integer)
    const db = getDb();
    const row = db
      .prepare("SELECT amount FROM expenses WHERE id = ?")
      .get(expense.id) as { amount: number };
    expect(row.amount).toBe(4999);
  });

  it("returns wasCreated=true for new records", () => {
    const { wasCreated } = createExpense({
      amount: 100,
      category: "Other",
      date: "2024-01-01",
    });
    expect(wasCreated).toBe(true);
  });

  it("returns amount as decimal rupees", () => {
    const { expense } = createExpense({
      amount: 100.5,
      category: "Transportation",
      date: "2024-02-20",
    });

    expect(expense.amount).toBe(100.5);
    expect(typeof expense.amount).toBe("number");
  });

  it("with same idempotency key returns existing record and wasCreated=false", () => {
    const key = "550e8400-e29b-41d4-a716-446655440000";

    const first = createExpense({
      amount: 25.0,
      category: "Shopping",
      date: "2024-03-01",
      idempotencyKey: key,
    });

    const second = createExpense({
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

  it("with negative amount throws", () => {
    expect(() =>
      createExpense({
        amount: -10,
        category: "Food & Dining",
        date: "2024-01-01",
      })
    ).toThrow("Amount must be positive");
  });

  it("with zero amount throws", () => {
    expect(() =>
      createExpense({
        amount: 0,
        category: "Food & Dining",
        date: "2024-01-01",
      })
    ).toThrow("Amount must be positive");
  });

  it("sets created_at automatically", () => {
    const before = new Date().toISOString();
    const { expense } = createExpense({
      amount: 10,
      category: "Other",
      date: "2024-01-01",
    });
    const after = new Date().toISOString();

    expect(expense.created_at >= before).toBe(true);
    expect(expense.created_at <= after).toBe(true);
  });

  it("handles description correctly", () => {
    const { expense } = createExpense({
      amount: 15,
      category: "Food & Dining",
      description: "Lunch at cafe",
      date: "2024-01-01",
    });

    expect(expense.description).toBe("Lunch at cafe");
  });

  it("defaults description to empty string", () => {
    const { expense } = createExpense({
      amount: 15,
      category: "Food & Dining",
      date: "2024-01-01",
    });

    expect(expense.description).toBe("");
  });
});

describe("listExpenses", () => {
  beforeEach(() => {
    createExpense({ amount: 100, category: "Food & Dining", date: "2024-01-15" });
    createExpense({ amount: 200, category: "Transportation", date: "2024-01-20" });
    createExpense({ amount: 50, category: "Food & Dining", date: "2024-01-10" });
    createExpense({ amount: 300, category: "Shopping", date: "2024-01-25" });
  });

  it("returns expenses with default limit", () => {
    const expenses = listExpenses();
    expect(expenses).toHaveLength(4);
  });

  it("filters by category", () => {
    const expenses = listExpenses({ category: "Food & Dining" });
    expect(expenses).toHaveLength(2);
    expect(expenses.every((e) => e.category === "Food & Dining")).toBe(true);
  });

  it("sorts by date descending by default", () => {
    const expenses = listExpenses();
    expect(expenses[0].date).toBe("2024-01-25");
    expect(expenses[expenses.length - 1].date).toBe("2024-01-10");
  });

  it("sorts by date ascending when requested", () => {
    const expenses = listExpenses({ sort: "date_asc" });
    expect(expenses[0].date).toBe("2024-01-10");
    expect(expenses[expenses.length - 1].date).toBe("2024-01-25");
  });

  it("respects limit parameter", () => {
    const expenses = listExpenses({ limit: 2 });
    expect(expenses).toHaveLength(2);
  });

  it("respects offset parameter", () => {
    const expenses = listExpenses({ limit: 2, offset: 2 });
    expect(expenses).toHaveLength(2);
    // With date_desc: first 2 are dates 25, 20; offset 2 gives 15, 10
    expect(expenses[0].date).toBe("2024-01-15");
  });

  it("returns empty array when category has no matches", () => {
    const expenses = listExpenses({ category: "Nonexistent" });
    expect(expenses).toHaveLength(0);
  });
});

describe("countExpenses", () => {
  beforeEach(() => {
    createExpense({ amount: 100, category: "Food & Dining", date: "2024-01-15" });
    createExpense({ amount: 200, category: "Transportation", date: "2024-01-20" });
    createExpense({ amount: 50, category: "Food & Dining", date: "2024-01-10" });
  });

  it("counts all expenses", () => {
    expect(countExpenses()).toBe(3);
  });

  it("counts by category", () => {
    expect(countExpenses({ category: "Food & Dining" })).toBe(2);
    expect(countExpenses({ category: "Transportation" })).toBe(1);
  });
});

describe("sumExpenses", () => {
  beforeEach(() => {
    createExpense({ amount: 100, category: "Food & Dining", date: "2024-01-15" });
    createExpense({ amount: 200.50, category: "Transportation", date: "2024-01-20" });
  });

  it("sums all expenses in decimal rupees", () => {
    expect(sumExpenses()).toBe(300.5);
  });

  it("sums by category", () => {
    expect(sumExpenses({ category: "Food & Dining" })).toBe(100);
  });

  it("returns 0 for empty result", () => {
    expect(sumExpenses({ category: "Nonexistent" })).toBe(0);
  });
});
