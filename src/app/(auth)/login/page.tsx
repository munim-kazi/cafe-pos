import { Suspense } from "react";
import LoginPageInner from "./LoginPageInner";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
