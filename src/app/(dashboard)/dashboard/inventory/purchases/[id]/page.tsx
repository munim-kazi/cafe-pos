import { getPurchase } from "@/app/actions/purchases";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import PurchaseDetailClient from "./PurchaseDetailClient";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;
  const result = await getPurchase(id);
  if (!result.success || !result.data) notFound();
  return <PurchaseDetailClient purchase={result.data} userRole={session.user.role} />;
}
