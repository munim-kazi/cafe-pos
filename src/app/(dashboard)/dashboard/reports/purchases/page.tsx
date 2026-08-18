import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import PurchaseReportClient from "./PurchaseReportClient";

export default async function PurchaseReportPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <PurchaseReportClient />;
}
