import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/features/session/LoginScreen";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  // useSearchParams (reason, next) needs a Suspense boundary for static rendering.
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
