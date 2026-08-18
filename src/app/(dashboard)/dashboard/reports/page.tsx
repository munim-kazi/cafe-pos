import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReportsHub from "./ReportsHub";

export default async function ReportsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <ReportsHub />;
}
