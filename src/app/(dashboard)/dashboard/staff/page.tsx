import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import StaffClient from "./StaffClient";

export default async function StaffPage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [staffResult, statsResult] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.user.aggregate({
      where: { active: true },
      _count: true,
    }),
  ]);

  const roleCounts = await db.user.groupBy({
    by: ["role"],
    where: { active: true },
    _count: true,
  });

  const recentlyActive = await db.user.count({
    where: {
      active: true,
      updatedAt: { gte: weekAgo },
    },
  });

  const initialStaff = staffResult.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: null as string | null,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
    lastLogin: null,
  }));

  const initialStats = {
    totalActive: statsResult._count,
    byRole: Object.fromEntries(
      roleCounts.map((r) => [r.role, r._count])
    ),
    recentlyActive,
  };

  const initialPagination = {
    total: await db.user.count(),
    page: 1,
    pageSize: 20,
    totalPages: Math.ceil((await db.user.count()) / 20),
  };

  return (
    <StaffClient
      userId={session.user.id}
      initialStaff={initialStaff}
      initialStats={initialStats}
      initialPagination={initialPagination}
    />
  );
}
