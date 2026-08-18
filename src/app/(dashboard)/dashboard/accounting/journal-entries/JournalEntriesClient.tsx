"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { getJournalEntries, reverseJournalEntryAction } from "@/app/actions/accounting";
import { formatDate } from "@/lib/utils";
import type { JournalEntryWithRelations } from "@/app/actions/accounting";

export default function JournalEntriesClient({ entries: initialEntries }: { entries: JournalEntryWithRelations[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [reverseModalEntry, setReverseModalEntry] = useState<JournalEntryWithRelations | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const result = await getJournalEntries({
      search: search || undefined,
      startDate: fromDate || undefined,
      endDate: toDate || undefined,
      pageSize: 50,
    });
    setLoading(false);
    if (result.success && result.data) {
      setEntries(result.data.items);
    }
  }, [search, fromDate, toDate]);

  const handleReverse = useCallback(async () => {
    if (!reverseModalEntry || !reverseReason.trim()) return;
    setReversing(true);
    const result = await reverseJournalEntryAction(reverseModalEntry.id, reverseReason);
    setReversing(false);
    if (result.success) {
      setReverseModalEntry(null);
      setReverseReason("");
      fetchEntries();
    } else {
      alert(result.error ?? "Failed to reverse entry");
    }
  }, [reverseModalEntry, reverseReason, fetchEntries]);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Journal Entries</h1>
        <p className="mt-1 text-sm text-gray-500">View all journal entries in the system.</p>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-64">
          <SearchInput placeholder="Search by entry# or description..." onSearch={(v) => { setSearch(v); }} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <button onClick={fetchEntries} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Apply Filters
        </button>
      </div>

      {loading ? (
        <div className="mt-6 text-center text-sm text-gray-500">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No journal entries found" description="Entries will appear here as transactions are processed." />
        </div>
      ) : (
        <div className="mt-6 hidden overflow-hidden rounded-lg border border-gray-200 md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Entry#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reference</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Lines</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created By</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <button onClick={() => router.push("/dashboard/accounting/journal-entries/" + entry.id)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                        {entry.entryNumber}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{formatDate(entry.date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{entry.description}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{entry.referenceType ?? "\u2014"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <span className={"inline-flex rounded-full px-2 py-0.5 text-xs font-medium " + (entry.isReversal ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800")}>
                        {entry.isReversal ? "Reversal" : "Normal"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">{entry.lines.length}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{entry.createdBy.name ?? "\u2014"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {!entry.isReversal && (
                        <button onClick={() => setReverseModalEntry(entry)} className="text-sm text-red-600 hover:text-red-800 font-medium">
                          Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile list */}
      <div className="mt-6 space-y-3 md:hidden">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <button onClick={() => router.push("/dashboard/accounting/journal-entries/" + entry.id)} className="text-sm font-medium text-indigo-600">
                  {entry.entryNumber}
                </button>
                <p className="mt-0.5 text-xs text-gray-500">{formatDate(entry.date)} &middot; {entry.description}</p>
                <p className="mt-0.5 text-xs text-gray-400">{entry.lines.length} lines &middot; {entry.createdBy.name ?? "Unknown"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={"inline-flex rounded-full px-2 py-0.5 text-xs font-medium " + (entry.isReversal ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800")}>
                  {entry.isReversal ? "Reversal" : "Normal"}
                </span>
                {!entry.isReversal && (
                  <button onClick={() => setReverseModalEntry(entry)} className="text-red-600 text-xs">Reverse</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reverse Modal */}
      <Modal open={!!reverseModalEntry} onClose={() => setReverseModalEntry(null)} title="Reverse Journal Entry">
        <div className="space-y-4">
          {reverseModalEntry && (
            <p className="text-sm text-gray-600">
              Are you sure you want to reverse entry <strong>{reverseModalEntry.entryNumber}</strong>? This will create a new entry that cancels it out.
            </p>
          )}
          <div>
            <label htmlFor="reverseReason" className="block text-sm font-medium text-gray-700">Reason</label>
            <textarea
              id="reverseReason"
              rows={3}
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              placeholder="Enter reason for reversal..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setReverseModalEntry(null)} className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Cancel</button>
            <button
              onClick={handleReverse}
              disabled={reversing || !reverseReason.trim()}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {reversing ? "Reversing..." : "Confirm Reversal"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
