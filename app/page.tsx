"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Expense } from "@/types/expense";
import ExpenseForm from "@/components/ExpenseForm";
import ExpenseTable from "@/components/ExpenseTable";
import FilterBar from "@/components/FilterBar";
import TotalBar from "@/components/TotalBar";

/** Format a number as Indian Rupees. */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function HomePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [sort, setSort] = useState<"date_desc" | "date_asc">("date_desc");

  /** Ref to hold the latest fetch function for child component callbacks. */
  const fetchRef = React.useRef<() => void>(() => {});

  // Fetch on mount and when filters change
  useEffect(() => {
    let cancelled = false;

    async function doFetch() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (filterCategory) params.set("category", filterCategory);
        params.set("sort", sort);

        const res = await fetch(`/api/expenses?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch expenses (${res.status})`);
        }

        const data = await res.json();
        if (!cancelled) {
          setExpenses(data.expenses);
          setTotal(data.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load expenses");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    doFetch();
    fetchRef.current = doFetch;

    return () => { cancelled = true; };
  }, [filterCategory, sort]);

  /** Stable callback for child components to trigger a refetch. */
  const refreshExpenses = useCallback(() => {
    fetchRef.current();
  }, []);

  /** Unique categories extracted from current expense list. */
  const categories = useMemo(() => {
    const cats = new Set(expenses.map((e) => e.category));
    return Array.from(cats).sort();
  }, [expenses]);

  /** Category summary: group expenses by category with subtotals. */
  const categorySummary = useMemo(() => {
    const map = new Map<string, { count: number; subtotal: number }>();
    for (const expense of expenses) {
      const existing = map.get(expense.category) || { count: 0, subtotal: 0 };
      existing.count += 1;
      existing.subtotal += expense.amount;
      map.set(expense.category, existing);
    }
    return Array.from(map.entries())
      .map(([category, { count, subtotal }]) => ({
        category,
        count,
        subtotal: Math.round(subtotal * 100) / 100,
      }))
      .sort((a, b) => b.subtotal - a.subtotal);
  }, [expenses]);

  return (
    <main className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-icon">💰</div>
          <div>
            <h1>Expense Tracker</h1>
            <p className="header-subtitle">Track your spending, stay in control</p>
          </div>
        </div>
      </header>

      {/* Form Section */}
      <section className="section">
        <ExpenseForm onSuccess={refreshExpenses} />
      </section>

      {/* Filter + Table Section */}
      <section className="section">
        <FilterBar
          categories={categories}
          selectedCategory={filterCategory}
          sort={sort}
          onCategoryChange={setFilterCategory}
          onSortChange={setSort}
        />

        <TotalBar total={total} count={expenses.length} />

        <ExpenseTable
          expenses={expenses}
          loading={loading}
          error={error}
          onRetry={refreshExpenses}
        />
      </section>

      {/* Category Summary */}
      {!loading && expenses.length > 0 && (
        <section className="section" id="category-summary">
          <h2 className="section-title">Summary by Category</h2>
          <div className="summary-grid">
            {categorySummary.map(({ category, count, subtotal }) => (
              <div key={category} className="summary-card">
                <div className="summary-card-header">
                  <span className="summary-category">{category}</span>
                  <span className="summary-count">
                    {count} item{count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="summary-amount">{formatCurrency(subtotal)}</div>
                {/* Progress bar showing percentage of total */}
                <div className="summary-bar-track">
                  <div
                    className="summary-bar-fill"
                    style={{
                      width: total > 0 ? `${(subtotal / total) * 100}%` : "0%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <p>Built with Next.js, TypeScript & SQLite — storing amounts in paise for precision</p>
      </footer>
    </main>
  );
}
