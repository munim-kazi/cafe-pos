import { getJournalEntry } from "@/app/actions/accounting";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import JournalEntryDetailClient from "./JournalEntryDetailClient";

export default async function JournalEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getJournalEntry(id);
  if (!result.success || !result.data) notFound();
  return <JournalEntryDetailClient entry={result.data} />;
}
