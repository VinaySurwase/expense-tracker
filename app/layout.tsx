import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Expense Tracker — Track Your Spending",
  description:
    "A production-quality personal expense tracker built with Next.js, TypeScript, and SQLite. Track spending, filter by category, and view summaries — all with paise-level precision.",
  keywords: ["expense tracker", "personal finance", "budget", "spending"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
