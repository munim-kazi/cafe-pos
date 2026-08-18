"use client";

import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { JournalEntryWithRelations } from "@/app/actions/accounting";

export default function JournalEntryDetailClient({ entry }: { entry: JournalEntryWithRelations }) {
  const router = useRouter();
  const totalDebits = entry.lines.reduce((s: number, l) => s + Number(l.debit.toString()), 0);
  const totalCredits = entry.lines.reduce((s: number, l) => s + Number(l.credit.toString()), 0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="text-sm text-indigo-600 hover:text-indigo-800">&larr; Back</button>
      </div>

      <div className="rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{entry.entryNumber}</h1>
            <p className="mt-1 text-sm text-gray-500">{entry.description}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">{formatDate(entry.date)}</p>
            <span className={"mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium " + (entry.isReversal ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800")}>
              {entry.isReversal ? "Reversal" : "Normal"}
            </span>
          </div>
        </div>

        <div className="mt-2 flex gap-6 text-sm text-gray-500">
          {entry.referenceType && <p>Reference: <span className="font-medium text-gray-700">{entry.referenceType}</span></p>}
          <p>Created by: <span className="font-medium text-gray-700">{entry.createdBy.name ?? "Unknown"}</span></p>
        </div>

        {/* Lines Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Account Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Account Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Debit</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {entry.lines.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{line.account.code}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{line.account.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{line.description ?? "\u2014"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                    {Number(line.debit.toString()) > 0 ? formatCurrency(Number(line.debit.toString())) : "\u2014"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                    {Number(line.credit.toString()) > 0 ? formatCurrency(Number(line.credit.toString())) : "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-900">Totals</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(totalDebits)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(totalCredits)}</td>
              </tr>
              <tr>
                <td colSpan={5} className="px-4 py-2 text-right text-xs">
                  <span className={"inline-flex rounded-full px-2 py-0.5 font-medium " + (Math.abs(totalDebits - totalCredits) < 0.01 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                    {Math.abs(totalDebits - totalCredits) < 0.01 ? "Balanced" : "Difference: " + formatCurrency(Math.abs(totalDebits - totalCredits))}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
