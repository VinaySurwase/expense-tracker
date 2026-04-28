"use client";

import type { Expense } from "@/types/expense";

/** Format a number as Indian Rupees. */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format an ISO date string to a readable format. */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

interface ExpenseTableProps {
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export default function ExpenseTable({
  expenses,
  loading,
  error,
  onRetry,
}: ExpenseTableProps) {
  if (error) {
    return (
      <div className="table-error" id="table-error" role="alert">
        <div className="error-icon">⚠️</div>
        <p className="error-message">{error}</p>
        <button onClick={onRetry} className="retry-btn" id="retry-btn">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="table-container" id="expense-table">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th className="amount-col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            // Skeleton loading rows
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="skeleton-row">
                <td><div className="skeleton skeleton-text" /></td>
                <td><div className="skeleton skeleton-text" /></td>
                <td><div className="skeleton skeleton-text-wide" /></td>
                <td><div className="skeleton skeleton-text" /></td>
              </tr>
            ))
          ) : expenses.length === 0 ? (
            <tr>
              <td colSpan={4} className="empty-state" id="empty-state">
                <div className="empty-icon">📊</div>
                <p className="empty-title">No expenses yet</p>
                <p className="empty-subtitle">
                  Add your first expense above to start tracking
                </p>
              </td>
            </tr>
          ) : (
            expenses.map((expense) => (
              <tr key={expense.id}>
                <td className="date-cell">{formatDate(expense.date)}</td>
                <td>
                  <span className="category-badge">{expense.category}</span>
                </td>
                <td className="description-cell">
                  {expense.description || (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="amount-cell">{formatCurrency(expense.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
