"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function useRouterRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return { refresh, isPending };
}
