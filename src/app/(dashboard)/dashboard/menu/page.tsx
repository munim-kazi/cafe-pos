import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function MenuPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
      <p className="mt-2 text-gray-600">
        Manage your cafe&apos;s menu categories and items.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/menu/categories"
          className="block rounded-lg border border-gray-200 p-6 shadow-sm transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
          <p className="mt-1 text-sm text-gray-500">
            Organize menu items into categories for easy browsing.
          </p>
        </Link>

        <Link
          href="/dashboard/menu/items"
          className="block rounded-lg border border-gray-200 p-6 shadow-sm transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-gray-900">Menu Items</h2>
          <p className="mt-1 text-sm text-gray-500">
            Add, edit, and manage individual menu items and pricing.
          </p>
        </Link>
      </div>
    </div>
  );
}
