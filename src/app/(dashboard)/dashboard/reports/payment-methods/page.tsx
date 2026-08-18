import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import PaymentMethodClient from "./PaymentMethodClient";

export default async function PaymentMethodsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <PaymentMethodClient />;
}
