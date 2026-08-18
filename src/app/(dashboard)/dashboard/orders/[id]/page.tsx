import { getOrder } from "@/app/actions/orders";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import OrderDetailClient from "./OrderDetailClient";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;
  const result = await getOrder(id);
  if (!result.success || !result.data) notFound();
  return (
    <OrderDetailClient
      order={result.data}
      userRole={session.user.role}
    />
  );
}
