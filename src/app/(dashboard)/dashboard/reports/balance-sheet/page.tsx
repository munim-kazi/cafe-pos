import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import BalanceSheetClient from "./BalanceSheetClient";

export default async function BalanceSheetPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <BalanceSheetClient />;
}
