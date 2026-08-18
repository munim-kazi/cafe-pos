"use client";

import { useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { createAccount, updateAccount } from "@/app/actions/accounting";
import type { Account } from "@/generated/prisma/client";

const TYPE_OPTIONS = ["", "ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

function typeBadgeColor(type: string): string {
  switch (type) {
    case "ASSET": return "bg-blue-100 text-blue-800";
    case "LIABILITY": return "bg-red-100 text-red-800";
    case "EQUITY": return "bg-purple-100 text-purple-800";
    case "REVENUE": return "bg-green-100 text-green-800";
    case "EXPENSE": return "bg-orange-100 text-orange-800";
    default: return "bg-gray-100 text-gray-600";
  }
}

export default function ChartOfAccountsClient({ accounts }: { accounts: Account[] }) {
  const [typeFilter, setTypeFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filtered = typeFilter ? accounts.filter((a) => a.type === typeFilter) : accounts;

  const handleCreate = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const result = await createAccount({
      code: form.get("code") as string,
      name: form.get("name") as string,
      type: form.get("type") as "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE",
      normalBalance: form.get("normalBalance") as "DEBIT" | "CREDIT",
      parentId: (form.get("parentId") as string) || undefined,
      description: (form.get("description") as string) || undefined,
    });
    setLoading(false);
    if (result.success) {
      setShowAddModal(false);
      window.location.reload();
    } else {
      setError(result.error ?? "Failed to create account");
    }
  }, []);

  const handleEdit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editAccount) return;
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const result = await updateAccount(editAccount.id, {
      name: form.get("name") as string,
      description: (form.get("description") as string) || undefined,
    });
    setLoading(false);
    if (result.success) {
      setEditAccount(null);
      window.location.reload();
    } else {
      setError(result.error ?? "Failed to update account");
    }
  }, [editAccount]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your accounts for double-entry bookkeeping.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add Account
        </button>
      </div>

      {/* Filter */}
      <div className="mt-4 flex gap-2">
        <span className="text-xs font-medium text-gray-500 self-center">Type:</span>
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={
              "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
              (typeFilter === t
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200")
            }
          >
            {t || "All"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No accounts found" description="Add your first account to get started." />
        </div>
      ) : (
        <div className="mt-6 hidden overflow-hidden rounded-lg border border-gray-200 md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Normal Balance</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filtered.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{account.code}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{account.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={"inline-flex rounded-full px-2 py-0.5 text-xs font-medium " + typeBadgeColor(account.type)}>
                        {account.type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{account.normalBalance}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <span className={"inline-flex rounded-full px-2 py-0.5 text-xs font-medium " + (account.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500")}>
                        {account.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        onClick={() => setEditAccount(account)}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      >
                        Edit
                      </button>
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
        {filtered.map((account) => (
          <div key={account.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{account.code} - {account.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">{account.normalBalance} &middot; Parent: {account.parentId ?? "None"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={"inline-flex rounded-full px-2 py-0.5 text-xs font-medium " + typeBadgeColor(account.type)}>
                  {account.type}
                </span>
                <button onClick={() => setEditAccount(account)} className="text-indigo-600 text-sm">Edit</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Account">
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Input label="Code" name="code" required placeholder="e.g. 1001" />
          <Input label="Name" name="name" required placeholder="e.g. Cash" />
          <Select label="Type" name="type" options={["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]} required />
          <Select label="Normal Balance" name="normalBalance" options={["DEBIT", "CREDIT"]} required />
          <Input label="Parent ID (optional)" name="parentId" placeholder="Leave empty if top-level" />
          <Input label="Description (optional)" name="description" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {loading ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editAccount} onClose={() => setEditAccount(null)} title="Edit Account">
        {editAccount && (
          <form onSubmit={handleEdit} className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700">Code</label>
              <p className="mt-1 text-sm text-gray-500">{editAccount.code}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <p className="mt-1 text-sm text-gray-500">{editAccount.type}</p>
            </div>
            <Input label="Name" name="name" defaultValue={editAccount.name} required />
            <Input label="Description" name="description" defaultValue={editAccount.description ?? ""} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditAccount(null)} className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function Input({ label, name, required, placeholder, defaultValue }: { label: string; name: string; required?: boolean; placeholder?: string; defaultValue?: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
      />
    </div>
  );
}

function Select({ label, name, options, required }: { label: string; name: string; options: string[]; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
      <select
        id={name}
        name={name}
        required={required}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
