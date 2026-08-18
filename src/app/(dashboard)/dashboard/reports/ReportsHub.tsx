"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const reportCards = [
  {
    title: "Sales Report",
    description: "Revenue, orders, and sales breakdown",
    href: "/dashboard/reports/sales",
    color: "border-l-indigo-500",
  },
  {
    title: "Purchase Report",
    description: "Supplier purchases and costs",
    href: "/dashboard/reports/purchases",
    color: "border-l-cyan-500",
  },
  {
    title: "Expense Report",
    description: "Operating expenses by category",
    href: "/dashboard/reports/expenses",
    color: "border-l-amber-500",
  },
  {
    title: "Profit & Loss",
    description: "Revenue, COGS, and net income",
    href: "/dashboard/reports/profit-loss",
    color: "border-l-emerald-500",
  },
  {
    title: "Balance Sheet",
    description: "Assets, liabilities, and equity",
    href: "/dashboard/reports/balance-sheet",
    color: "border-l-rose-500",
  },
  {
    title: "Cash Flow",
    description: "Cash inflows and outflows",
    href: "/dashboard/reports/cash-flow",
    color: "border-l-purple-500",
  },
  {
    title: "Best Sellers",
    description: "Top selling products",
    href: "/dashboard/reports/best-sellers",
    color: "border-l-teal-500",
  },
  {
    title: "Payment Analysis",
    description: "Payment method breakdown",
    href: "/dashboard/reports/payment-methods",
    color: "border-l-orange-500",
  },
];

export default function ReportsHub() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {reportCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={cn(
              "rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md",
              "border-l-4",
              card.color
            )}
          >
            <h2 className="font-semibold text-gray-900">{card.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
