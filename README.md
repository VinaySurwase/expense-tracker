# Expense Tracker

A production-quality personal expense tracker built with **Next.js 14**, **TypeScript**, and **SQLite**. Designed as a technical assessment demonstrating engineering rigor — proper money handling, idempotent API design, comprehensive validation, and clean architecture.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite)
![Tests](https://img.shields.io/badge/Tests-35%20passing-green)

---

## Live Demo

> **Live Demo:** [https://expenzo-expense-tracker127.vercel.app](https://expenzo-expense-tracker127.vercel.app)

---

## Running Locally

### Prerequisites

- **Node.js** 20+ and **npm** 9+
- Git

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/VinaySurwase/expense-tracker.git
cd expense-tracker

# 2. Install dependencies
npm install

# 3. Set up environment variables (optional — defaults work out of the box)
cp .env.local.example .env.local

# 4. Start the development server
npm run dev

# 5. Open in browser
open http://localhost:3000
```

The SQLite database file (`expenses.db`) will be created automatically on first request.

### Running Tests

```bash
npm test              # Run all tests
npm test -- --coverage # With coverage report
```

### Docker

```bash
docker compose up --build   # Start with persistent volume
curl http://localhost:3000/api/health  # Verify health
```

---

## Architecture

### Request Flow

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐     ┌──────────┐
│   Browser    │────▶│  Next.js Route   │────▶│  Zod Validation │────▶│  Repository      │────▶│  SQLite  │
│   (React)    │◀────│  Handler         │◀────│  (schemas)      │◀────│  (lib/expenses)  │◀────│  (WAL)   │
└──────────────┘     └──────────────────┘     └─────────────────┘     └──────────────────┘     └──────────┘
     │                       │                                                 │
     │  Idempotency-Key      │  Rate Limiting                                 │  INSERT ON CONFLICT
     │  (crypto.randomUUID)  │  (in-memory)                                   │  (atomic dedup)
     │  AbortController      │  Security Headers                              │  Paise conversion
     └───────────────────────┘                                                └──────────────────
```

### Tech Stack

| Technology | Role | Why |
|---|---|---|
| **Next.js 14 (App Router)** | Framework | Monorepo — API routes and React UI in a single codebase. Server-side rendering, file-system routing, and Vercel-native deployment. |
| **TypeScript (strict mode)** | Language | Compile-time type safety, self-documenting interfaces, and zero `any` types throughout. |
| **SQLite via better-sqlite3** | Database | ACID-compliant, zero-infrastructure, file-based persistence. Perfect for a single-user personal finance tool. |
| **Zod** | Validation | Runtime schema validation at the API boundary with auto TypeScript type inference. |
| **Vanilla CSS** | Styling | Premium dark theme with glassmorphism, micro-animations, and full responsive design. |

### Project Structure

```
lib/
  db.ts              → SQLite singleton (adapter pattern — swap for Postgres)
  expenses.ts        → Repository (all DB queries, money conversion, idempotency)
  validation.ts      → Zod schemas (single source of truth for validation)
  format.ts          → Shared formatting utilities (formatCurrency, formatDate)

types/
  expense.ts         → Shared TypeScript interfaces + CATEGORIES constant

app/
  api/expenses/      → REST API handlers (POST + GET with pagination)
  api/health/        → Health check endpoint
  page.tsx           → Main page with debounced filters + AbortController
  layout.tsx         → Root layout with next/font
  globals.css        → Design system (800+ lines, dark theme)

components/
  ExpenseForm.tsx    → Form with idempotency key + success toast + timeout
  ExpenseTable.tsx   → Table with skeleton/empty/error states
  FilterBar.tsx      → Category filter + sort toggle
  TotalBar.tsx       → Total display with INR formatting

__tests__/
  expenses.test.ts   → 22 unit tests for repository layer
  api.test.ts        → 13 integration tests for API routes

instrumentation.ts   → Graceful shutdown handler (SIGTERM → closeDb)
Dockerfile           → Multi-stage production build
docker-compose.yml   → Local development with persistent volume
.github/workflows/   → CI pipeline (lint → test → build)
```

---

## Key Design Decisions

### Money Handling

**Amounts are stored as integers in paise (1/100th of a rupee), never as floating-point numbers.**

- IEEE 754 cannot exactly represent values like `0.1`. This leads to: `0.1 + 0.2 === 0.30000000000000004`.
- In financial software, even tiny rounding errors compound over thousands of transactions.
- By storing `₹49.99` as the integer `4999` (paise), we guarantee exact arithmetic.

**Conversion boundary:** happens exactly once on write and once on read, both in `lib/expenses.ts`.

```
User input (₹49.99) → API receives 49.99 → Repository stores 4999 → API returns 49.99 → UI displays ₹49.99
```

### Idempotency (Safe Retries)

The POST endpoint supports **idempotent requests** via the `Idempotency-Key` header:

1. **Client generates a UUID** using `crypto.randomUUID()` (stored in React `useRef`).
2. **On submit**, the UUID is sent as the `Idempotency-Key` header.
3. **On network error**, the user retries — the **same key is reused**, preventing duplicates.
4. **On success**, a **new UUID is generated** for the next submission.
5. **Server-side**, uses `INSERT ... ON CONFLICT(idempotency_key) DO NOTHING` inside a **transaction** — eliminates TOCTOU race conditions.

### Security

- **Security headers**: X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy
- **Rate limiting**: In-memory sliding window (60 req/min per IP)
- **Input validation**: Zod schemas at API boundary — rejects invalid dates, negative amounts, overflows
- **SQL injection prevention**: All queries use parameterized statements
- **No stack traces leaked**: Generic error messages returned to clients

### Persistence

**Why SQLite:**

- ACID-compliant with WAL mode for concurrent reads
- Zero configuration — the database is a single file
- Repository pattern + adapter pattern make it swappable to PostgreSQL in a one-file change

**Vercel note:** Serverless filesystems are ephemeral. For production, replace with a hosted DB (Turso, Neon, Supabase).

---

## API Reference

### `POST /api/expenses` (also available at `POST /expenses`)

Create a new expense.

**Headers:**
- `Content-Type: application/json`
- `Idempotency-Key: <uuid>` (recommended)

**Body:**
```json
{
  "amount": 49.99,
  "category": "Food & Dining",
  "description": "Lunch at cafe",
  "date": "2024-01-15"
}
```

**Responses:**
- `201 Created` — expense created successfully
- `200 OK` — duplicate idempotency key, existing expense returned
- `400 Bad Request` — malformed JSON body
- `422 Unprocessable Entity` — validation error (with field-level details)
- `429 Too Many Requests` — rate limit exceeded
- `500 Internal Server Error` — unexpected failure (no stack traces)

### `GET /api/expenses` (also available at `GET /expenses`)

List expenses with optional filtering and pagination.

**Query Parameters:**
- `category` (string, optional) — filter by category
- `sort` (`date_desc` | `date_asc`, default: `date_desc`)
- `limit` (1-100, default: 50)
- `offset` (>= 0, default: 0)

**Response:**
```json
{
  "expenses": [
    {
      "id": "uuid",
      "amount": 49.99,
      "category": "Food & Dining",
      "description": "Lunch at cafe",
      "date": "2024-01-15",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 49.99,
  "count": 1,
  "limit": 50,
  "offset": 0,
  "hasMore": false
}
```

### `GET /api/health`

Health check endpoint.

```json
{ "status": "ok", "timestamp": "2024-01-15T10:30:00.000Z", "uptime": 3600.5 }
```

---

## Deployment

### Vercel (recommended)

```bash
npm i -g vercel
vercel
# Or: gh repo create expense-tracker --public --source=. --push
```

### Docker

```bash
docker compose up --build -d
```

---

## What I Would Add With More Time

- **Authentication** — NextAuth.js with GitHub/Google OAuth
- **Edit/Delete expenses** — PATCH and DELETE endpoints with optimistic UI
- **Charts** — recharts for spending trends over time
- **E2E tests** — Playwright for browser-based testing
- **CSV export** — download expense data as CSV
- **PostgreSQL** — for multi-user deployment with connection pooling

## Intentional Omissions

| Feature | Reason |
|---|---|
| Authentication | Out of scope for a single-user tool |
| Edit/Delete | Not in the acceptance criteria |
| Charts | Would add with recharts given more time |
| Multi-currency | Requires exchange rate API, out of scope |

---

## License

This project is licensed under the [MIT License](LICENSE).

© 2026 Vinay Surwase
