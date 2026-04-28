"use client";

/** Format a number as Indian Rupees. */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface TotalBarProps {
  total: number;
  count: number;
}

export default function TotalBar({ total, count }: TotalBarProps) {
  return (
    <div className="total-bar" id="total-bar">
      <div className="total-info">
        <span className="total-count">
          Showing <strong>{count}</strong> expense{count !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="total-amount">
        <span className="total-label">Total</span>
        <span className="total-value">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
