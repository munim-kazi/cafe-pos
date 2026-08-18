"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getOrders } from "@/app/actions/orders";
import { formatCurrency } from "@/lib/utils";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface OrderItem {
  id: string;
}

interface OrderWithRelations {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  paymentStatus: string;
  subtotal: { toString(): string };
  discountAmount: { toString(): string };
  taxRate: { toString(): string };
  taxAmount: { toString(): string };
  grandTotal: { toString(): string };
  notes: string | null;
  createdAt: Date | string;
  table: { number: number } | null;
  customer: { name: string } | null;
  items: OrderItem[];
  createdBy: { name: string | null };
}

interface Props {
  initialOrders: OrderWithRelations[];
}

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Ready", value: "READY" },
  { label: "Served", value: "SERVED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const PAYMENT_STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Unpaid", value: "UNPAID" },
  { label: "Partial", value: "PARTIAL" },
  { label: "Paid", value: "PAID" },
];

function statusColor(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-yellow-100 text-yellow-800";
    case "CONFIRMED":
      return "bg-blue-100 text-blue-800";
    case "IN_PROGRESS":
      return "bg-orange-100 text-orange-800";
    case "READY":
      return "bg-green-100 text-green-800";
    case "SERVED":
      return "bg-green-100 text-green-800";
    case "COMPLETED":
      return "bg-gray-100 text-gray-600";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function paymentStatusColor(status: string): string {
  switch (status) {
    case "UNPAID":
      return "bg-red-100 text-red-800";
    case "PARTIAL":
      return "bg-yellow-100 text-yellow-800";
    case "PAID":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-BD", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersClient({ initialOrders }: Props) {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithRelations[]>(initialOrders);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [, startTransition] = useTransition();

  const fetchOrders = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const result = await getOrders({
      status: statusFilter || undefined,
      paymentStatus: paymentFilter || undefined,
      search: search || undefined,
      page: 1,
      pageSize: 50,
    });
    setLoading(false);
    if (result.success && result.data) {
      startTransition(() => {
        setOrders(result.data!.items);
      });
    }
  }, [statusFilter, paymentFilter, search, startTransition]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshing(true);
      fetchOrders({ silent: true }).finally(() => setRefreshing(false));
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage all orders.
            {refreshing && <span className="ml-2 text-xs text-gray-400">Refreshing...</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-3">
        <div className="w-full sm:w-64">
          <SearchInput placeholder="Search by order number..." onSearch={handleSearch} />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-gray-500 self-center mr-1">Status:</span>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={
                "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
                (statusFilter === opt.value
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-gray-500 self-center mr-1">Payment:</span>
          {PAYMENT_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPaymentFilter(opt.value)}
              className={
                "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
                (paymentFilter === opt.value
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : initialOrders.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No orders yet"
            description="Orders will appear here once they are created from the POS."
          />
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No orders found"
            description="Try adjusting your filters or search term."
          />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-hidden rounded-lg border border-gray-200 md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Order#
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Table
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Items
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Total
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Payment
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push("/dashboard/orders/" + order.id)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-indigo-600">
                        {order.orderNumber}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {order.type.replace("_", " ")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {order.table ? "#" + order.table.number : "\u2014"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {order.customer?.name ?? "\u2014"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">
                        {order.items.length}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(Number(order.grandTotal.toString()))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <span className={"inline-flex rounded-full px-2 py-0.5 text-xs font-medium " + paymentStatusColor(order.paymentStatus)}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <span className={"inline-flex rounded-full px-2 py-0.5 text-xs font-medium " + statusColor(order.status)}>
                          {order.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {formatTime(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="mt-6 space-y-3 md:hidden">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => router.push("/dashboard/orders/" + order.id)}
                className="cursor-pointer rounded-lg border border-gray-200 p-4 hover:border-gray-300"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-indigo-600">{order.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {order.type.replace("_", " ")}
                      {order.table ? " \u2022 Table #" + order.table.number : ""}
                      {order.customer ? " \u2022 " + order.customer.name : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {order.items.length} items \u2022 {formatTime(order.createdAt)}
                    </p>
                  </div>
                  <div className="ml-3 text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(Number(order.grandTotal.toString()))}
                    </p>
                    <span className={"mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium " + statusColor(order.status)}>
                      {order.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
