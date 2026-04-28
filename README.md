# Expense Tracker

A production-quality personal expense tracker built with **Next.js 14**, **TypeScript**, and **SQLite**. Designed as a technical assessment demonstrating engineering rigor — proper money handling, idempotent API design, comprehensive validation, and clean architecture.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss)

---

## Live Demo

> Deployed on Vercel: [link will be added after deployment]

---

## Running Locally

### Prerequisites

- **Node.js** 18+ and **npm** 9+
- Git

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/expense-tracker.git
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
npm test
```

---

## Architecture & Key Design Decisions

### Tech Stack

| Technology | Role | Why |
|---|---|---|
| **Next.js 14 (App Router)** | Framework | Monorepo architecture — API routes and React UI in a single codebase. Server-side rendering, file-system routing, and Vercel-native deployment. |
| **TypeScript (strict mode)** | Language | Compile-time type safety, self-documenting interfaces, and zero `any` types throughout the codebase. |
| **SQLite via better-sqlite3** | Database | ACID-compliant, zero-infrastructure, file-based persistence. Perfect for a single-user personal finance tool. No separate database server process required. |
| **Zod** | Validation | Runtime schema validation at the API boundary with automatic TypeScript type inference. Catches malformed requests before they reach the data layer. |
| **Tailwind CSS** | Styling | Utility-first CSS framework for rapid, consistent UI development with a premium dark theme. |

### Money Handling

**Amounts are stored as integers in paise (1/100th of a rupee), never as floating-point numbers.**

This is a deliberate engineering decision:

- IEEE 754 floating-point cannot exactly represent values like `0.1` or `0.3`. This leads to arithmetic errors: `0.1 + 0.2 === 0.30000000000000004`.
- In financial software, even tiny rounding errors compound over thousands of transactions.
- By storing `₹49.99` as the integer `4999` (paise), we guarantee exact arithmetic.

**Conversion boundary:**

```
User input (₹49.99) → API receives 49.99 → Repository stores 4999 → API returns 49.99 → UI displays ₹49.99
```

The conversion happens exactly once on write (`Math.round(amount * 100)`) and once on read (`amount / 100`), both in `lib/expenses.ts`. No other code ever touches paise.

### Idempotency

The POST endpoint supports **idempotent requests** via the `Idempotency-Key` header. This prevents duplicate expenses from network retries or double-clicks.

**End-to-end flow:**

1. **Client generates a UUID** when the form is first rendered (stored in a React `useRef`, not state).
2. **On submit**, the UUID is sent as the `Idempotency-Key` header.
3. **On network error**, the user can retry — the **same key is reused**, ensuring the server knows this is a retry, not a new expense.
4. **On success**, a **new UUID is generated** for the next submission.
5. **Server-side**, the `idempotency_key` column has a `UNIQUE` constraint. If a duplicate key arrives, the existing row is returned with HTTP `200` (not `201`), and no new row is created.

This design makes the "Add Expense" operation safe to call any number of times with the same key.

### Persistence

**Why SQLite over PostgreSQL/MongoDB:**

For a single-user personal finance tool:

- SQLite is **ACID-compliant** — transactions are safe.
- It requires **no server process** — the database is a single file.
- It's **trivially inspectable** — `sqlite3 expenses.db` gives you a REPL.
- It has **zero configuration** — no connection strings, no auth, no ports.
- The data file **persists across restarts** during development.

For a multi-user production system, you would swap SQLite for PostgreSQL. The codebase uses a **repository pattern** (`lib/expenses.ts`) and **adapter pattern** (`lib/db.ts`), so this is a one-file change.

**Note on Vercel deployment:** Vercel's filesystem is ephemeral on serverless functions. The SQLite file persists during a single deployment session but is lost on redeployment. For production persistence, replace `better-sqlite3` with a hosted database such as PlanetScale, Neon, or Supabase.

### Project Structure

```
lib/db.ts          → SQLite singleton (adapter pattern — swap this for Postgres)
lib/expenses.ts    → Repository layer (all DB queries, money conversion)
lib/validation.ts  → Zod schemas (single source of truth for validation)
types/expense.ts   → Shared TypeScript interfaces
app/api/expenses/  → REST API handlers (POST + GET)
components/        → React UI components
__tests__/         → Unit + integration tests
```

### What I Would Add With More Time

- **User authentication** — NextAuth.js with GitHub/Google OAuth
- **Pagination** — cursor-based pagination for large datasets
- **Edit / delete expenses** — PATCH and DELETE endpoints with optimistic UI updates
- **Charts** — recharts for spending trends over time
- **Multi-currency support** — ISO 4217 currency codes with exchange rate API
- **PostgreSQL** — for multi-user deployment with connection pooling
- **E2E tests** — Playwright for browser-based testing
- **CSV export** — download expense data as CSV

### Intentional Omissions

| Feature | Reason |
|---|---|
| Authentication | Out of scope for a single-user personal tool demo |
| Pagination | Dataset assumed small for this assessment |
| Edit/Delete | Not in the acceptance criteria |
| Charts | Would add with recharts given more time |
| CI/CD pipeline | Would add GitHub Actions for lint/test/deploy |

---

## API Reference

### `POST /api/expenses`

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
- `422 Unprocessable Entity` — validation error
- `500 Internal Server Error` — unexpected failure

### `GET /api/expenses`

List expenses with optional filtering.

**Query Parameters:**
- `category` (string, optional) — filter by category
- `sort` (`date_desc` | `date_asc`, default: `date_desc`)

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
  "total": 49.99
}
```

---

## Deployment

### Vercel (recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Or push to GitHub and connect via Vercel dashboard
gh repo create expense-tracker --public --source=. --push
```

Then connect the repository at [vercel.com/new](https://vercel.com/new).

---

## License

MIT
