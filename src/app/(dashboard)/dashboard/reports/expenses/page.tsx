import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ExpenseReportClient from "./ExpenseReportClient";

export default async function ExpenseReportPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <ExpenseReportClient />;
}
