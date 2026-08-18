"use client";

import { type ReactNode } from "react";

interface POSLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  header?: ReactNode;
}

/**
 * POS-optimized layout for tablet/desktop POS terminals.
 * Full-width, no scrolling chrome, optimized for touch.
 *
 * Layout:
 * ┌──────────────────────────────────┐
 * │ Header (order info, table)       │
 * ├──────────────────┬───────────────┤
 * │                  │               │
 * │  Product Grid    │  Cart Panel   │
 * │  (scrollable)    │  (scrollable) │
 * │                  │               │
 * ├──────────────────┴───────────────┤
 * │ Action Bar (payment, print, etc) │
 * └──────────────────────────────────┘
 */
export function POSLayout({ children, sidebar, header }: POSLayoutProps) {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      {header && (
        <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-2">
          {header}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
        {sidebar && (
          <div className="w-80 shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50">
            {sidebar}
          </div>
        )}
      </div>
    </div>
  );
}
