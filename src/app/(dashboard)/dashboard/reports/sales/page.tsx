import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SalesReportClient from "./SalesReportClient";

export default async function SalesReportPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <SalesReportClient />;
}
