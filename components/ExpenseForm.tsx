"use client";

import { useRef, useState } from "react";
import { CATEGORIES } from "@/types/expense";

/** Predefined categories imported from shared types. */

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
  const [success, setSuccess] = useState(false);

  // Idempotency key stored in a ref — persists across re-renders,
  // reused on retries, only regenerated after confirmed success.
  // Uses browser-native crypto.randomUUID() — no external dependency needed.
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    // Client-side timeout with AbortController (10 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      // Success — reset form and generate a NEW idempotency key
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);
      setCategory(CATEGORIES[0]);
      idempotencyKeyRef.current = crypto.randomUUID();
      setSuccess(true);
      onSuccess();

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      clearTimeout(timeoutId);
      // On error, keep the SAME idempotency key so retries are safe
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="expense-form" id="expense-form">
      <h2 className="form-title">Add Expense</h2>

      {/* Success toast */}
      {success && (
        <div className="form-success" role="status" id="form-success" aria-live="polite">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Expense added successfully!</span>
        </div>
      )}

      {/* Error banner */}
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
            max="99999999.99"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            disabled={submitting}
            aria-label="Expense amount in rupees"
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
            aria-label="Expense category"
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
            aria-label="Expense date"
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
            aria-label="Expense description"
          />
        </div>
      </div>

      <button
        type="submit"
        id="submit-expense"
        className="submit-btn"
        disabled={submitting}
        aria-label={submitting ? "Saving expense" : "Add expense"}
      >
        {submitting ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Saving...
          </>
        ) : (
          "Add Expense"
        )}
      </button>
    </form>
  );
}
