import { getJournalEntries } from "@/app/actions/accounting";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import JournalEntriesClient from "./JournalEntriesClient";

export default async function JournalEntriesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getJournalEntries({ page: 1, pageSize: 50 });
  return <JournalEntriesClient entries={result.data?.items ?? []} />;
}
