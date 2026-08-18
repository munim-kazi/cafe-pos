"use client";

import { useState, useCallback } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getGeneralLedger } from "@/app/actions/accounting";
import { EmptyState } from "@/components/ui/EmptyState";
import type { GeneralLedgerLine } from "@/app/actions/accounting";

export default function GeneralLedgerClient({
  accounts,
}: {
  accounts: { id: string; code: string; name: string }[];
}) {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [entries, setEntries] = useState<GeneralLedgerLine[]>([]);
  const [accountInfo, setAccountInfo] = useState<{ code: string; name: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchData = useCallback(async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    const result = await getGeneralLedger({
      accountId: selectedAccountId,
      startDate: fromDate || new Date().toISOString().slice(0, 10),
      endDate: toDate || new Date().toISOString().slice(0, 10),
    });
    setLoading(false);
    setFetched(true);
    if (result.success && result.data) {
      setEntries(result.data);
      const acct = accounts.find((a) => a.id === selectedAccountId);
      if (acct) setAccountInfo({ code: acct.code, name: acct.name, type: "—" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, fromDate, toDate]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">General Ledger</h1>
      <p className="mt-1 text-sm text-gray-500">View transaction history for any account.</p>

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-72">
          <label className="block text-xs text-gray-500 mb-1">Account</label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">Select an account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <button onClick={fetchData} disabled={!selectedAccountId || loading} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {loading ? "Loading..." : "View Ledger"}
        </button>
      </div>

      {/* Account Summary */}
      {accountInfo && (
        <div className="mt-4 rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Account</p>
          <p className="text-base font-semibold text-gray-900">{accountInfo.code} - {accountInfo.name}</p>
          <p className="text-xs text-gray-400">Type: {accountInfo.type}</p>
        </div>
      )}

      {!fetched ? (
        <div className="mt-6">
          <EmptyState title="Select an account" description="Choose an account and date range to view its ledger entries." />
        </div>
      ) : loading ? (
        <div className="mt-6 text-center text-sm text-gray-500">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No entries found" description="No transactions for this account in the selected period." />
        </div>
      ) : (
        <div className="mt-6 hidden overflow-hidden rounded-lg border border-gray-200 md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Entry#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Credit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{formatDate(entry.journalEntry.date)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-indigo-600">{entry.journalEntry.entryNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{entry.journalEntry.description}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : "\u2014"}
                    </td>
                    <td className={"whitespace-nowrap px-4 py-3 text-right text-sm font-medium " + (entry.runningBalance >= 0 ? "text-gray-900" : "text-red-600")}>
                      {formatCurrency(Math.abs(entry.runningBalance))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
