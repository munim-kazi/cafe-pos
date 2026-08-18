import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfitLossClient from "./ProfitLossClient";

export default async function ProfitLossPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <ProfitLossClient />;
}
