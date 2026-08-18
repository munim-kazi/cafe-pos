"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", roles: ["ADMIN", "MANAGER", "CASHIER", "KITCHEN"] },
  { label: "POS", href: "/dashboard/pos", roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { label: "Orders", href: "/dashboard/orders", roles: ["ADMIN", "MANAGER", "CASHIER", "KITCHEN"] },
  { label: "Kitchen", href: "/dashboard/kitchen", roles: ["ADMIN", "MANAGER", "CASHIER", "KITCHEN"] },
  { label: "Tables", href: "/dashboard/tables", roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { label: "Menu", href: "/dashboard/menu", roles: ["ADMIN", "MANAGER"] },
  { label: "Inventory", href: "/dashboard/inventory", roles: ["ADMIN", "MANAGER"] },
  { label: "Accounting", href: "/dashboard/accounting", roles: ["ADMIN"] },
  { label: "Reports", href: "/dashboard/reports", roles: ["ADMIN"] },
  { label: "Staff", href: "/dashboard/staff", roles: ["ADMIN"] },
  { label: "Settings", href: "/dashboard/settings", roles: ["ADMIN"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const filteredNav = navItems.filter(
    (item) => userRole && item.roles.includes(userRole)
  );

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center border-b border-gray-200 px-4">
        <h1 className="text-lg font-bold text-gray-900">Cafe POS</h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {filteredNav.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-gray-200 p-4">
        <div className="mb-2 text-sm">
          <p className="font-medium text-gray-900">{session?.user?.name}</p>
          <p className="text-gray-500">{session?.user?.role}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
