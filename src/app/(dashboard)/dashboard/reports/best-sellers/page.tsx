import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import BestSellersClient from "./BestSellersClient";

export default async function BestSellersPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <BestSellersClient />;
}
