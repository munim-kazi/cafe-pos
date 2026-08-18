import { getCategories } from "@/app/actions/categories";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import CategoriesClient from "./CategoriesClient";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getCategories();
  return <CategoriesClient initialCategories={result.data ?? []} userRole={session.user.role} />;
}
