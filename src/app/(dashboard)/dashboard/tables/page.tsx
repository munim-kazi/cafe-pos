import { getTables } from "@/app/actions/tables";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TablesClient from "./TablesClient";

export default async function TablesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getTables();
  return <TablesClient initialTables={result.data ?? []} userRole={session.user.role} />;
}
