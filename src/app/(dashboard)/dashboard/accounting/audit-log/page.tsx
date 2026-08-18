import { getAuditLogs } from "@/app/actions/accounting";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AuditLogClient from "./AuditLogClient";

export default async function AuditLogPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getAuditLogs({ page: 1, pageSize: 20 });
  const logs = (result.data?.items ?? []).map((l) => ({
    id: l.id,
    timestamp: l.createdAt,
    userName: l.user?.name ?? "Unknown",
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    details: l.newValues ? JSON.stringify(l.newValues) : "",
  }));
  return (
    <AuditLogClient
      initialLogs={logs}
      initialTotal={result.data?.total ?? 0}
      initialTotalPages={result.data?.totalPages ?? 1}
    />
  );
}
