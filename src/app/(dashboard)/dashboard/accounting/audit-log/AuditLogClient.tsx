"use client";

import { useState, useCallback } from "react";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAuditLogs } from "@/app/actions/accounting";

type AuditLogItem = { id: string; timestamp: Date; userName: string; action: string; entity: string; entityId: string | null; details: string };

const ACTION_OPTIONS = ["", "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "APPROVE", "REVERSE"];

function actionBadgeColor(action: string): string {
  switch (action) {
    case "CREATE": return "bg-green-100 text-green-800";
    case "UPDATE": return "bg-blue-100 text-blue-800";
    case "DELETE": return "bg-red-100 text-red-800";
    case "LOGIN": return "bg-purple-100 text-purple-800";
    case "LOGOUT": return "bg-gray-100 text-gray-600";
    case "APPROVE": return "bg-teal-100 text-teal-800";
    case "REVERSE": return "bg-amber-100 text-amber-800";
    default: return "bg-gray-100 text-gray-600";
  }
}

export default function AuditLogClient({
  initialLogs,
  initialTotal,
  initialTotalPages,
}: {
  initialLogs: AuditLogItem[];
  initialTotal: number;
  initialTotalPages: number;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [entitySearch, setEntitySearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    const result = await getAuditLogs({
      page: p,
      pageSize: 20,
      action: actionFilter || undefined,
      entity: entitySearch || undefined,
      startDate: fromDate || undefined,
      endDate: toDate || undefined,
    });
    setLoading(false);
    if (result.success && result.data) {
      setLogs(result.data.items.map((l) => ({
        id: l.id,
        timestamp: l.createdAt,
        userName: l.user?.name ?? "Unknown",
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        details: l.newValues ? JSON.stringify(l.newValues) : "",
      })));
      setTotal(result.data.total);
      setTotalPages(result.data.totalPages);
      setPage(p);
    }
  }, [actionFilter, entitySearch, fromDate, toDate]);

  const handleApplyFilters = useCallback(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
      <p className="mt-1 text-sm text-gray-500">Track all system activity and changes. {total} entries total.</p>

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Action</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Actions</option>
            {ACTION_OPTIONS.filter(Boolean).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Entity Search</label>
          <input
            type="text"
            value={entitySearch}
            onChange={(e) => setEntitySearch(e.target.value)}
            placeholder="e.g. Order, Customer"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <button onClick={handleApplyFilters} disabled={loading} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {loading ? "Loading..." : "Apply"}
        </button>
      </div>

      {loading ? (
        <div className="mt-6 text-center text-sm text-gray-500">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No audit logs found" description="No entries match your filters." />
        </div>
      ) : (
        <div className="mt-6 hidden overflow-hidden rounded-lg border border-gray-200 md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">User</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Entity ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{log.userName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <span className={"inline-flex rounded-full px-2 py-0.5 text-xs font-medium " + actionBadgeColor(log.action)}>
                        {log.action}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{log.entity}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 font-mono text-xs">{log.entityId ?? "\u2014"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{log.details || "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile */}
      <div className="mt-6 space-y-3 md:hidden">
        {logs.map((log) => (
          <div key={log.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={"inline-flex rounded-full px-2 py-0.5 text-xs font-medium " + actionBadgeColor(log.action)}>
                    {log.action}
                  </span>
                  <span className="text-xs text-gray-500">{log.entity}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{log.userName} &middot; {formatDate(log.timestamp)}</p>
                {log.details && <p className="mt-0.5 text-xs text-gray-400 truncate max-w-[250px]">{log.details}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => fetchLogs(page - 1)}
              disabled={page <= 1}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => fetchLogs(page + 1)}
              disabled={page >= totalPages}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
