/**
 * Integration tests for the API route handlers.
 *
 * These tests mock the database module to isolate the API layer.
 * They verify request validation, response shapes, status codes,
 * and proper header handling.
 */

import { POST, GET } from "@/app/api/expenses/route";
import { NextRequest } from "next/server";

// Mock the expenses module — all functions return Promises now
jest.mock("@/lib/expenses", () => ({
  createExpense: jest.fn(),
  listExpenses: jest.fn(),
  countExpenses: jest.fn(),
  sumExpenses: jest.fn(),
}));

// Suppress expected console.error output in tests
beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

import { createExpense, listExpenses, countExpenses, sumExpenses } from "@/lib/expenses";

const mockCreateExpense = createExpense as jest.MockedFunction<typeof createExpense>;
const mockListExpenses = listExpenses as jest.MockedFunction<typeof listExpenses>;
const mockCountExpenses = countExpenses as jest.MockedFunction<typeof countExpenses>;
const mockSumExpenses = sumExpenses as jest.MockedFunction<typeof sumExpenses>;

/** Helper to create a NextRequest for POST. */
function createPostRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest("http://localhost:3000/api/expenses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/** Helper to create a NextRequest for GET. */
function createGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/expenses");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

describe("POST /api/expenses", () => {
  it("with valid body returns 201 for new record", async () => {
    const mockExpense = {
      id: "test-id",
      amount: 49.99,
      category: "Food & Dining",
      description: "Lunch",
      date: "2024-01-15",
      created_at: new Date().toISOString(),
    };

    mockCreateExpense.mockResolvedValue({ expense: mockExpense, wasCreated: true });

    const req = createPostRequest({
      amount: 49.99,
      category: "Food & Dining",
      description: "Lunch",
      date: "2024-01-15",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe("test-id");
    expect(data.amount).toBe(49.99);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("with idempotent duplicate returns 200", async () => {
    const mockExpense = {
      id: "existing-id",
      amount: 49.99,
      category: "Food & Dining",
      description: "Lunch",
      date: "2024-01-15",
      created_at: new Date().toISOString(),
    };

    mockCreateExpense.mockResolvedValue({ expense: mockExpense, wasCreated: false });

    const req = createPostRequest(
      { amount: 49.99, category: "Food & Dining", date: "2024-01-15" },
      { "Idempotency-Key": "550e8400-e29b-41d4-a716-446655440000" }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("with negative amount returns 422", async () => {
    const req = createPostRequest({
      amount: -10,
      category: "Food & Dining",
      date: "2024-01-15",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toBe("Validation failed");
  });

  it("missing required fields returns 422", async () => {
    const req = createPostRequest({ amount: 10 });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("with invalid date format returns 422", async () => {
    const req = createPostRequest({
      amount: 10,
      category: "Food & Dining",
      date: "15-01-2024",
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("with invalid calendar date returns 422", async () => {
    const req = createPostRequest({
      amount: 10,
      category: "Food & Dining",
      date: "2024-02-31",
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("with amount exceeding max returns 422", async () => {
    const req = createPostRequest({
      amount: 100000000,
      category: "Food & Dining",
      date: "2024-01-15",
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("with malformed JSON returns 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("passes Idempotency-Key header to createExpense", async () => {
    const idempotencyKey = "550e8400-e29b-41d4-a716-446655440000";
    const mockExpense = {
      id: "test-id",
      amount: 10,
      category: "Other",
      description: "",
      date: "2024-01-01",
      created_at: new Date().toISOString(),
    };

    mockCreateExpense.mockResolvedValue({ expense: mockExpense, wasCreated: true });

    const req = createPostRequest(
      { amount: 10, category: "Other", date: "2024-01-01" },
      { "Idempotency-Key": idempotencyKey }
    );

    await POST(req);

    expect(mockCreateExpense).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey })
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockCreateExpense.mockRejectedValue(new Error("DB connection failed"));

    const req = createPostRequest({
      amount: 10,
      category: "Other",
      date: "2024-01-01",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
    expect(data.stack).toBeUndefined();
  });
});

describe("GET /api/expenses", () => {
  it("returns paginated response", async () => {
    const mockExpenses = [
      { id: "1", amount: 100, category: "Food", description: "", date: "2024-01-15", created_at: "" },
      { id: "2", amount: 200, category: "Transport", description: "", date: "2024-01-20", created_at: "" },
    ];

    mockListExpenses.mockResolvedValue(mockExpenses);
    mockCountExpenses.mockResolvedValue(5);
    mockSumExpenses.mockResolvedValue(300);

    const req = createGetRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.expenses).toHaveLength(2);
    expect(data.total).toBe(300);
    expect(data.count).toBe(5);
    expect(data.hasMore).toBe(true);
    expect(data.limit).toBe(50);
    expect(data.offset).toBe(0);
  });

  it("with category filter calls listExpenses correctly", async () => {
    mockListExpenses.mockResolvedValue([]);
    mockCountExpenses.mockResolvedValue(0);
    mockSumExpenses.mockResolvedValue(0);

    const req = createGetRequest({ category: "Food & Dining" });
    await GET(req);

    expect(mockListExpenses).toHaveBeenCalledWith(
      expect.objectContaining({ category: "Food & Dining" })
    );
  });

  it("with invalid sort param returns 422", async () => {
    const req = createGetRequest({ sort: "invalid_sort" });
    const res = await GET(req);

    expect(res.status).toBe(422);
  });

  it("returns empty array when no expenses", async () => {
    mockListExpenses.mockResolvedValue([]);
    mockCountExpenses.mockResolvedValue(0);
    mockSumExpenses.mockResolvedValue(0);

    const req = createGetRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(data.expenses).toHaveLength(0);
    expect(data.total).toBe(0);
    expect(data.hasMore).toBe(false);
  });
});
