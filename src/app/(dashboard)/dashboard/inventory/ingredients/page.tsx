import { getIngredients } from "@/app/actions/inventory";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import IngredientsClient from "./IngredientsClient";

export default async function IngredientsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getIngredients();
  return (
    <IngredientsClient
      initialIngredients={result.data?.ingredients ?? []}
      userRole={session.user.role}
    />
  );
}
