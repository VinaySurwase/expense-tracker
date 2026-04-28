"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Expense } from "@/types/expense";
import { formatCurrency } from "@/lib/format";
import ExpenseForm from "@/components/ExpenseForm";
import ExpenseTable from "@/components/ExpenseTable";
import FilterBar from "@/components/FilterBar";
import TotalBar from "@/components/TotalBar";

/** Debounce delay for filter changes (ms). */
const DEBOUNCE_MS = 300;

export default function HomePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [sort, setSort] = useState<"date_desc" | "date_asc">("date_desc");

  // Debounced filter category — delays API call until user stops typing/selecting
  const [debouncedCategory, setDebouncedCategory] = useState("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce category changes
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedCategory(filterCategory);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [filterCategory]);

  /** Ref to hold the latest fetch function for child component callbacks. */
  const fetchRef = React.useRef<() => void>(() => {});

  // Fetch on mount and when filters change (uses debounced category)
  useEffect(() => {
    const controller = new AbortController();

    async function doFetch() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (debouncedCategory) params.set("category", debouncedCategory);
        params.set("sort", sort);

        const res = await fetch(`/api/expenses?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch expenses (${res.status})`);
        }

        const data = await res.json();
        setExpenses(data.expenses);
        setTotal(data.total);
      } catch (err) {
        // Don't set error state for aborted requests
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load expenses");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    doFetch();
    fetchRef.current = doFetch;

    return () => { controller.abort(); };
  }, [debouncedCategory, sort]);

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
      {/* Skip to content link for keyboard users */}
      <a href="#expense-form" className="skip-link">Skip to form</a>

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
      <section className="section" aria-label="Add new expense">
        <ExpenseForm onSuccess={refreshExpenses} />
      </section>

      {/* Filter + Table Section */}
      <section className="section" aria-label="Expense list">
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
        <section className="section" id="category-summary" aria-label="Category summary">
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
                <div className="summary-bar-track" role="progressbar" aria-valuenow={Math.round((subtotal / total) * 100)} aria-valuemin={0} aria-valuemax={100}>
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
