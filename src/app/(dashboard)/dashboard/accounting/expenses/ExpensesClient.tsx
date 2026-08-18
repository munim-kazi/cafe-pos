"use client";

import { useState, useCallback } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { createExpense, getExpenses } from "@/app/actions/accounting";

type ExpenseItem = { id: string; description: string; amount: number; date: Date; accountName: string; createdBy: string };

export default function ExpensesClient({
  expenses: initial,
  accounts,
}: {
  expenses: ExpenseItem[];
  accounts: { id: string; code: string; name: string }[];
}) {
  const [expenses, setExpenses] = useState(initial);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filtering, setFiltering] = useState(false);

  const filterExpenses = useCallback(async () => {
    setFiltering(true);
    const result = await getExpenses({ startDate: fromDate || undefined, endDate: toDate || undefined });
    setFiltering(false);
    if (result.success && result.data) {
      const acctMap = new Map(accounts.map((a) => [a.id, a.name]));
      setExpenses(result.data.items.map((e) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
        date: e.date,
        accountName: acctMap.get(e.accountId) ?? "Unknown",
        createdBy: e.createdBy.name ?? "Unknown",
      })));
    }
  }, [fromDate, toDate, accounts]);

  const handleCreate = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const result = await createExpense({
      description: form.get("description") as string,
      amount: parseFloat(form.get("amount") as string),
      accountId: form.get("accountId") as string,
      date: (form.get("date") as string) || undefined,
    });
    setLoading(false);
    if (result.success) {
      setShowAddModal(false);
      const refreshed = await getExpenses({ startDate: fromDate || undefined, endDate: toDate || undefined });
      if (refreshed.success && refreshed.data) {
        const acctMap = new Map(accounts.map((a) => [a.id, a.name]));
        setExpenses(refreshed.data.items.map((e) => ({
          id: e.id,
          description: e.description,
          amount: Number(e.amount),
          date: e.date,
          accountName: acctMap.get(e.accountId) ?? "Unknown",
          createdBy: e.createdBy.name ?? "Unknown",
        })));
      }
    } else {
      setError(result.error ?? "Failed to create expense");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="mt-1 text-sm text-gray-500">Track and manage business expenses.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Add Expense
        </button>
      </div>

      {/* Date Filter */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <button onClick={filterExpenses} disabled={filtering} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {filtering ? "Loading..." : "Apply"}
        </button>
      </div>

      {filtering ? (
        <div className="mt-6 text-center text-sm text-gray-500">Loading...</div>
      ) : expenses.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No expenses found" description="Add your first expense to start tracking." />
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-hidden rounded-lg border border-gray-200 md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Account</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{formatDate(exp.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{exp.description}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-red-600">{formatCurrency(exp.amount)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{exp.accountName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{exp.createdBy}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-red-600">{formatCurrency(totalExpenses)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="mt-6 space-y-3 md:hidden">
            {expenses.map((exp) => (
              <div key={exp.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{exp.description}</p>
                    <p className="text-xs text-gray-500">{exp.accountName} &middot; {exp.createdBy}</p>
                    <p className="text-xs text-gray-400">{formatDate(exp.date)}</p>
                  </div>
                  <p className="text-sm font-medium text-red-600">{formatCurrency(exp.amount)}</p>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
              <p className="text-sm font-bold text-gray-900">Total: <span className="text-red-600">{formatCurrency(totalExpenses)}</span></p>
            </div>
          </div>
        </>
      )}

      {/* Add Expense Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Expense">
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label htmlFor="expDesc" className="block text-sm font-medium text-gray-700">Description</label>
            <input id="expDesc" name="description" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" placeholder="e.g. Office supplies" />
          </div>
          <div>
            <label htmlFor="expAmount" className="block text-sm font-medium text-gray-700">Amount</label>
            <input id="expAmount" name="amount" type="number" step="0.01" min="0.01" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" placeholder="0.00" />
          </div>
          <div>
            <label htmlFor="expAccount" className="block text-sm font-medium text-gray-700">Account</label>
            <select id="expAccount" name="accountId" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none">
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="expDate" className="block text-sm font-medium text-gray-700">Date</label>
            <input id="expDate" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {loading ? "Creating..." : "Create Expense"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
