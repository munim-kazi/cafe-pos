"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatCurrency, cn } from "@/lib/utils";
import type { DashboardStats, SalesReportData, BestSellingProduct } from "@/app/actions/reports";

type Props = {
  stats: DashboardStats | undefined;
  sales: SalesReportData | undefined;
  topItems: BestSellingProduct[] | undefined;
};

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", color ?? "text-gray-900")}>
        {value}
      </p>
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1" style={{ height: 120 }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-gray-500">
            {d.value > 0 ? formatCurrency(d.value) : ""}
          </span>
          <div
            className="w-full rounded-t bg-indigo-500"
            style={{
              height: `${Math.max((d.value / max) * 100, 2)}%`,
              minHeight: d.value > 0 ? 4 : 0,
            }}
          />
          <span className="text-[10px] text-gray-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardClient({ stats, sales, topItems }: Props) {
  const last7Days = useMemo(() => {
    if (!sales?.daily) return [];
    const today = new Date();
    const days: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = sales.daily.find((day) => day.date === key);
      days.push({
        label: d.toLocaleDateString("en-BD", { weekday: "short" }),
        value: found?.revenue ?? 0,
      });
    }
    return days;
  }, [sales]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Today's Revenue"
          value={formatCurrency(stats?.todayRevenue ?? 0)}
        />
        <StatCard
          label="Today's Orders"
          value={stats?.todayOrders ?? 0}
        />
        <StatCard
          label="Monthly Revenue"
          value={formatCurrency(stats?.monthlyRevenue ?? 0)}
        />
        <StatCard
          label="Monthly Orders"
          value={stats?.monthlyOrders ?? 0}
        />
        <StatCard
          label="Pending Orders"
          value={stats?.pendingOrders ?? 0}
          color={cn(
            "text-gray-900",
            (stats?.pendingOrders ?? 0) > 0 && "text-amber-600"
          )}
        />
        <StatCard
          label="Low Stock Alerts"
          value={stats?.lowStockAlerts ?? 0}
          color={cn(
            "text-gray-900",
            (stats?.lowStockAlerts ?? 0) > 0 && "text-red-600"
          )}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-gray-900">Last 7 Days Revenue</h2>
          {last7Days.length > 0 ? (
            <BarChart data={last7Days} />
          ) : (
            <p className="text-sm text-gray-500">No data available</p>
          )}
        </div>

        {/* Quick Links */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 font-semibold text-gray-900">Quick Links</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "POS", href: "/dashboard/pos", color: "bg-indigo-500" },
              { label: "Kitchen", href: "/dashboard/kitchen", color: "bg-amber-500" },
              { label: "Orders", href: "/dashboard/orders", color: "bg-emerald-500" },
              { label: "Inventory", href: "/dashboard/inventory", color: "bg-cyan-500" },
              { label: "Reports", href: "/dashboard/reports", color: "bg-purple-500" },
              { label: "Menu", href: "/dashboard/menu", color: "bg-rose-500" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center justify-center rounded-md px-3 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90",
                  link.color
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Best Selling Products */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 font-semibold text-gray-900">Best Selling Products</h2>
          {topItems && topItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-2">#</th>
                    <th className="pb-2 pr-2">Product</th>
                    <th className="pb-2 pr-2">Category</th>
                    <th className="pb-2 pr-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((item) => (
                    <tr key={item.rank} className="border-b last:border-0">
                      <td className="py-2 pr-2 text-gray-500">{item.rank}</td>
                      <td className="py-2 pr-2 font-medium text-gray-900">{item.name}</td>
                      <td className="py-2 pr-2 text-gray-500">{item.category}</td>
                      <td className="py-2 pr-2 text-right">{item.quantitySold}</td>
                      <td className="py-2 text-right font-medium">
                        {formatCurrency(item.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No sales data yet</p>
          )}
        </div>

        {/* Recent Sales Summary */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 font-semibold text-gray-900">Monthly Sales Summary</h2>
          {sales ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Total Orders</span>
                <span className="font-medium">{sales.totalOrders}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Total Revenue</span>
                <span className="font-medium">{formatCurrency(sales.totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Avg Order Value</span>
                <span className="font-medium">{formatCurrency(sales.avgOrderValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Tax Collected</span>
                <span className="font-medium">{formatCurrency(sales.totalTax)}</span>
              </div>
              <div className="border-t pt-3">
                <h3 className="mb-2 text-sm font-medium text-gray-700">By Order Type</h3>
                {sales.byOrderType.map((item) => (
                  <div key={item.type} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{item.type.replace("_", " ")}</span>
                    <span>{item.count} orders / {formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
