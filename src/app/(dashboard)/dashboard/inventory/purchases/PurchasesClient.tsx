"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getPurchases } from "@/app/actions/purchases";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Purchase } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import type { PaginatedResponse } from "@/types";

type PurchaseWithRelations = Purchase & {
  supplier: { id: string; name: string; company: string | null; dueBalance: unknown };
  createdBy: { id: string; name: string; role: Role };
  _count: { items: number };
};

interface Props {
  initialPurchases: PaginatedResponse<PurchaseWithRelations> | undefined;
  userRole: Role;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

type StatusFilter = "ALL" | "DRAFT" | "RECEIVED" | "CANCELLED";

const STATUS_OPTIONS: StatusFilter[] = ["ALL", "DRAFT", "RECEIVED", "CANCELLED"];

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  RECEIVED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function PurchasesClient({ initialPurchases, userRole }: Props) {
  const router = useRouter();
  const [purchases, setPurchases] = useState<PurchaseWithRelations[]>(
    initialPurchases?.items ?? []
  );
  const [pagination, setPagination] = useState({
    page: initialPurchases?.page ?? 1,
    totalPages: initialPurchases?.totalPages ?? 1,
    total: initialPurchases?.total ?? 0,
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const canCreate = userRole === "ADMIN" || userRole === "MANAGER";

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchPurchases = useCallback(
    async (page: number, status: StatusFilter, search?: string) => {
      setLoading(true);
      try {
        const result = await getPurchases({
          page,
          pageSize: 20,
          status: status === "ALL" ? undefined : status,
          search: search || undefined,
        });
        if (result.success && result.data) {
          setPurchases(result.data.items);
          setPagination({
            page: result.data.page,
            totalPages: result.data.totalPages,
            total: result.data.total,
          });
        } else {
          showToast(result.error ?? "Failed to fetch purchases", "error");
        }
      } catch {
        showToast("An unexpected error occurred", "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  const handleSearch = useCallback(
    (value: string) => {
      fetchPurchases(1, statusFilter, value);
    },
    [statusFilter, fetchPurchases]
  );

  const handleStatusChange = (status: StatusFilter) => {
    setStatusFilter(status);
    fetchPurchases(1, status);
  };

  const handlePageChange = (page: number) => {
    fetchPurchases(page, statusFilter);
  };

  const toastClass =
    "fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg " +
    (toast?.type === "success" ? "bg-green-600" : "bg-red-600");

  return (
    <div>
      {toast && <div className={toastClass}>{toast.message}</div>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage inventory purchases and supplier orders.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push("/dashboard/inventory/purchases/new")}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Create Purchase
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:w-64">
          <SearchInput placeholder="Search by purchase #..." onSearch={handleSearch} />
        </div>
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium",
                statusFilter === status
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {status}
            </button>
          ))}
        </div>
        {loading && (
          <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        )}
      </div>

      {purchases.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No purchases found"
            description={
              statusFilter !== "ALL"
                ? "No purchases match the selected filter."
                : "Create your first purchase to get started."
            }
            action={
              canCreate && statusFilter === "ALL" ? (
                <button
                  onClick={() => router.push("/dashboard/inventory/purchases/new")}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Create Purchase
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-hidden rounded-lg border border-gray-200 md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Purchase#
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Items
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Paid
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {purchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() =>
                      router.push("/dashboard/inventory/purchases/" + purchase.id)
                    }
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-indigo-600">
                      {purchase.purchaseNumber}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {purchase.supplier.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatDate(purchase.date)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {purchase._count.items}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(Number(purchase.total))}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                      {formatCurrency(Number(purchase.paidAmount))}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          STATUS_BADGE[purchase.status] ?? "bg-gray-100 text-gray-800"
                        )}
                      >
                        {purchase.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push("/dashboard/inventory/purchases/" + purchase.id);
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-6 space-y-3 md:hidden">
            {purchases.map((purchase) => (
              <div
                key={purchase.id}
                className="cursor-pointer rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
                onClick={() =>
                  router.push("/dashboard/inventory/purchases/" + purchase.id)
                }
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-indigo-600">
                      {purchase.purchaseNumber}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {purchase.supplier.name}{" \u2022 "}{formatDate(purchase.date)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {purchase._count.items} item{purchase._count.items !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(Number(purchase.total))}
                    </p>
                    <span
                      className={cn(
                        "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_BADGE[purchase.status] ?? "bg-gray-100 text-gray-800"
                      )}
                    >
                      {purchase.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
