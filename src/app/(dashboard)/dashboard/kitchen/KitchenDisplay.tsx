"use client";

import { useState, useEffect, useCallback } from "react";
import {
  updateKOTStatus,
  updateKOTItemStatus,
  getKitchenOrders,
} from "@/app/actions/kitchen";
import type { Role } from "@/generated/prisma/enums";

interface KOTItem {
  id: string;
  name: string;
  quantity: number;
  addons: string | null;
  notes: string | null;
  status: string;
}

interface KitchenOrder {
  id: string;
  kotNumber: number;
  status: string;
  notes: string | null;
  createdAt: Date | string;
  order: {
    id: string;
    orderNumber: string;
    type: string;
    table: { number: number; section: string | null } | null;
  };
  items: KOTItem[];
}

interface Props {
  initialKOTs: KitchenOrder[];
  userRole: Role;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

type FilterTab = "ALL" | "PENDING" | "IN_PROGRESS" | "READY";

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Ready", value: "READY" },
];

function borderClass(status: string): string {
  if (status === "PENDING") return "border-l-amber-400";
  if (status === "IN_PROGRESS") return "border-l-blue-500";
  if (status === "READY") return "border-l-green-500";
  return "border-l-gray-300";
}

function statusDotClass(status: string): string {
  if (status === "PENDING") return "bg-amber-400";
  if (status === "IN_PROGRESS") return "bg-blue-500";
  if (status === "READY") return "bg-green-500";
  return "bg-gray-300";
}

function typeBadgeClass(type: string): string {
  if (type === "DINE_IN") return "bg-blue-100 text-blue-800";
  if (type === "TAKEAWAY") return "bg-purple-100 text-purple-800";
  if (type === "DELIVERY") return "bg-orange-100 text-orange-800";
  return "bg-gray-100 text-gray-800";
}

function timeAgo(dateStr: Date | string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return diffSec + "s ago";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return diffMin + " min ago";
  const diffHr = Math.floor(diffMin / 60);
  return diffHr + "h " + (diffMin % 60) + "m ago";
}

function minutesSince(dateStr: Date | string): number {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  return Math.floor((now - then) / 60000);
}

let toastId = 0;

export default function KitchenDisplay({ initialKOTs, userRole }: Props) {
  const [kots, setKots] = useState<KitchenOrder[]>(initialKOTs);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [updatingKotId, setUpdatingKotId] = useState<string | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const refresh = useCallback(async () => {
    const result = await getKitchenOrders();
    if (result.success && result.data) {
      setKots(result.data);
    }
  }, []);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Tick every 10s for time-ago updates
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  now; // keep now referenced so the tick effect works

  const handleKotStatus = useCallback(
    async (kotId: string, status: "IN_PROGRESS" | "READY" | "SERVED") => {
      setUpdatingKotId(kotId);
      const result = await updateKOTStatus(kotId, status);
      setUpdatingKotId(null);
      if (result.success) {
        addToast("KOT status updated", "success");
        await refresh();
      } else {
        addToast(result.error ?? "Failed to update", "error");
      }
    },
    [addToast, refresh]
  );

  const handleItemStatus = useCallback(
    async (itemId: string, status: "IN_PROGRESS" | "READY" | "SERVED") => {
      setUpdatingItemId(itemId);
      const result = await updateKOTItemStatus(itemId, status);
      setUpdatingItemId(null);
      if (result.success) {
        addToast("Item status updated", "success");
        await refresh();
      } else {
        addToast(result.error ?? "Failed to update", "error");
      }
    },
    [addToast, refresh]
  );

  const handleStartAll = useCallback(
    async (kotId: string) => {
      setUpdatingKotId(kotId);
      const result = await updateKOTStatus(kotId, "IN_PROGRESS");
      setUpdatingKotId(null);
      if (result.success) {
        addToast("All items started", "success");
        await refresh();
      } else {
        addToast(result.error ?? "Failed to start", "error");
      }
    },
    [addToast, refresh]
  );

  const isKitchen = userRole === "KITCHEN";
  const canMarkServed = userRole === "CASHIER" || userRole === "MANAGER" || userRole === "ADMIN";

  const filtered = kots.filter((kot) => {
    if (filter === "ALL") return true;
    return kot.status === filter;
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const pendingCount = kots.filter((k) => k.status === "PENDING").length;
  const inProgressCount = kots.filter((k) => k.status === "IN_PROGRESS").length;
  const readyCount = kots.filter((k) => k.status === "READY").length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Toast container */}
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={
              "rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all " +
              (toast.type === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white")
            }
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              Kitchen Display
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {kots.length} active KOT{kots.length !== 1 ? "s" : ""}
              <span className="mx-2 text-gray-300">|</span>
              <span className="text-amber-600">{pendingCount} pending</span>
              <span className="mx-2 text-gray-300">|</span>
              <span className="text-blue-600">{inProgressCount} cooking</span>
              <span className="mx-2 text-gray-300">|</span>
              <span className="text-green-600">{readyCount} ready</span>
            </p>
          </div>
          <button
            onClick={() => refresh()}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.value === "ALL"
              ? kots.length
              : tab.value === "PENDING"
                ? pendingCount
                : tab.value === "IN_PROGRESS"
                  ? inProgressCount
                  : readyCount;
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={
                "rounded-full px-4 py-2 text-sm font-medium transition-colors " +
                (filter === tab.value
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-600 shadow-sm hover:bg-gray-50")
              }
            >
              {tab.label}
              <span
                className={
                  "ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs " +
                  (filter === tab.value
                    ? "bg-indigo-500 text-indigo-100"
                    : "bg-gray-100 text-gray-500")
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* KOT Grid */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-20">
          <svg
            className="h-16 w-16 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No active KOTs
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            New orders will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((kot) => {
            const mins = minutesSince(kot.createdAt);
            const isUrgent = mins >= 10 && kot.status !== "READY";
            const isUpdating = updatingKotId === kot.id;
            const allPending = kot.items.every((i) => i.status === "PENDING");

            return (
              <div
                key={kot.id}
                className={
                  "relative rounded-lg border-l-4 bg-white shadow-md transition-shadow hover:shadow-lg " +
                  borderClass(kot.status)
                }
              >
                {/* Urgent indicator */}
                {isUrgent && (
                  <div className="absolute -right-1 -top-1">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="border-b border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">
                        KOT #{kot.kotNumber}
                      </span>
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                          typeBadgeClass(kot.order.type)
                        }
                      >
                        {kot.order.type.replace("_", " ")}
                      </span>
                    </div>
                    <span
                      className={
                        "flex items-center gap-1 text-xs font-medium " +
                        (isUrgent ? "text-red-600" : "text-gray-400")
                      }
                    >
                      {isUrgent && (
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                      )}
                      {timeAgo(kot.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                    <span className="font-medium text-indigo-600">
                      {kot.order.orderNumber}
                    </span>
                    {kot.order.table ? (
                      <span>
                        Table #{kot.order.table.number}
                        {kot.order.table.section
                          ? " (" + kot.order.table.section + ")"
                          : ""}
                      </span>
                    ) : null}
                  </div>
                  {kot.notes && (
                    <p className="mt-1 text-xs italic text-gray-500">
                      {kot.notes}
                    </p>
                  )}
                </div>

                {/* Items */}
                <div className="max-h-64 overflow-y-auto px-4 py-3">
                  <ul className="space-y-3">
                    {kot.items.map((item) => {
                      const isItemUpdating = updatingItemId === item.id;
                      return (
                        <li key={item.id} className="group">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2">
                              <span
                                className={
                                  "mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full " +
                                  statusDotClass(item.status)
                                }
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-base font-bold text-gray-900">
                                    {item.name}
                                  </span>
                                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-bold text-gray-700">
                                    x{item.quantity}
                                  </span>
                                </div>
                                {item.addons && (
                                  <p className="mt-0.5 text-xs text-gray-500">
                                    {item.addons}
                                  </p>
                                )}
                                {item.notes && (
                                  <p className="mt-0.5 text-xs italic text-gray-400">
                                    {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Individual item buttons */}
                            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              {isKitchen && item.status === "PENDING" && (
                                <button
                                  disabled={isItemUpdating}
                                  onClick={() =>
                                    handleItemStatus(item.id, "IN_PROGRESS")
                                  }
                                  className="rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                                >
                                  Start
                                </button>
                              )}
                              {isKitchen && item.status === "IN_PROGRESS" && (
                                <button
                                  disabled={isItemUpdating}
                                  onClick={() =>
                                    handleItemStatus(item.id, "READY")
                                  }
                                  className="rounded bg-green-500 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-green-600 disabled:opacity-50"
                                >
                                  Ready
                                </button>
                              )}
                              {canMarkServed && item.status === "READY" && (
                                <button
                                  disabled={isItemUpdating}
                                  onClick={() =>
                                    handleItemStatus(item.id, "SERVED")
                                  }
                                  className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  Served
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Status badge */}
                <div className="border-t border-gray-100 px-4 py-2">
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold " +
                      (kot.status === "PENDING"
                        ? "bg-amber-100 text-amber-800"
                        : kot.status === "IN_PROGRESS"
                          ? "bg-blue-100 text-blue-800"
                          : kot.status === "READY"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800")
                    }
                  >
                    <span
                      className={
                        "mr-1.5 h-2 w-2 rounded-full " +
                        statusDotClass(kot.status)
                      }
                    />
                    {kot.status.replace("_", " ")}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {isKitchen && kot.status === "PENDING" && allPending && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleStartAll(kot.id)}
                        className="flex-1 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isUpdating ? "Starting..." : "Start All"}
                      </button>
                    )}
                    {isKitchen && kot.status === "PENDING" && !allPending && (
                      <button
                        disabled={isUpdating}
                        onClick={() =>
                          handleKotStatus(kot.id, "IN_PROGRESS")
                        }
                        className="flex-1 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isUpdating ? "Starting..." : "Start Preparing"}
                      </button>
                    )}
                    {isKitchen && kot.status === "IN_PROGRESS" && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleKotStatus(kot.id, "READY")}
                        className="flex-1 rounded-lg bg-green-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        {isUpdating ? "Marking..." : "Mark Ready"}
                      </button>
                    )}
                    {canMarkServed && kot.status === "READY" && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleKotStatus(kot.id, "SERVED")}
                        className="flex-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {isUpdating ? "Marking..." : "Mark Served"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
