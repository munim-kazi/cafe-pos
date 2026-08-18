"use client";

import { useState, useCallback } from "react";
import { printReceipt, type ReceiptData } from "@/lib/hardware/receipt-printer";

interface PrintReceiptButtonProps {
  receiptData: ReceiptData;
  variant?: "primary" | "secondary" | "icon";
  label?: string;
}

export function PrintReceiptButton({
  receiptData,
  variant = "secondary",
  label,
}: PrintReceiptButtonProps) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = useCallback(() => {
    setPrinting(true);
    try {
      printReceipt(receiptData);
    } catch (err) {
      console.error("Print failed:", err);
    } finally {
      setTimeout(() => setPrinting(false), 1000);
    }
  }, [receiptData]);

  if (variant === "icon") {
    return (
      <button
        onClick={handlePrint}
        disabled={printing}
        title="Print Receipt"
        className="inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
      >
        {printing ? (
          <svg
            className="h-5 w-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
        )}
      </button>
    );
  }

  if (variant === "primary") {
    return (
      <button
        onClick={handlePrint}
        disabled={printing}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {printing ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Printing...
          </>
        ) : (
          label ?? "Print Receipt"
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handlePrint}
      disabled={printing}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {printing ? (
        <>
          <svg
            className="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Printing...
        </>
      ) : (
        label ?? "Print Receipt"
      )}
    </button>
  );
}
