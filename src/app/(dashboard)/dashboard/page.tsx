import { getDashboardStats, getSalesReport, getBestSellingProducts } from "@/app/actions/reports";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [statsResult, salesResult, topItemsResult] = await Promise.all([
    getDashboardStats(),
    getSalesReport({ startDate: startOfDay, endDate: endOfMonth }),
    getBestSellingProducts({ startDate: startOfMonth, endDate: endOfMonth, limit: 5 }),
  ]);

  return (
    <DashboardClient
      stats={statsResult.data}
      sales={salesResult.data}
      topItems={topItemsResult.data}
    />
  );
}
