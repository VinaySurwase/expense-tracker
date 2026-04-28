"use client";

import { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

/** Predefined categories for the expense form. */
const CATEGORIES = [
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

interface ExpenseFormProps {
  onSuccess: () => void;
}

export default function ExpenseForm({ onSuccess }: ExpenseFormProps) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Idempotency key stored in a ref — persists across re-renders,
  // reused on retries, only regenerated after confirmed success.
  const idempotencyKeyRef = useRef(uuidv4());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          category,
          description,
          date,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      // Success — reset form and generate a NEW idempotency key
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);
      setCategory(CATEGORIES[0]);
      idempotencyKeyRef.current = uuidv4();
      onSuccess();
    } catch (err) {
      // On error, keep the SAME idempotency key so retries are safe
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="expense-form" id="expense-form">
      <h2 className="form-title">Add Expense</h2>

      {error && (
        <div className="form-error" role="alert" id="form-error">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="amount">Amount (₹)</label>
          <input
            id="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            disabled={submitting}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="date">Date</label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={submitting}
          />
        </div>

        <div className="form-group form-group-wide">
          <label htmlFor="description">Description</label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was this expense for?"
            maxLength={500}
            disabled={submitting}
          />
        </div>
      </div>

      <button
        type="submit"
        id="submit-expense"
        className="submit-btn"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <span className="spinner" />
            Saving...
          </>
        ) : (
          "Add Expense"
        )}
      </button>
    </form>
  );
}
