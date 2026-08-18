import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import CashFlowClient from "./CashFlowClient";

export default async function CashFlowPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <CashFlowClient />;
}
