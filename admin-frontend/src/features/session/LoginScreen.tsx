"use client";
// M1. Sign in (admin/SCREENS.md): the author sign-in pattern for the support console.
import { Button, Notice, TextField } from "@bookleaf/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { NO_ACCESS_MESSAGE, useSession } from "@/providers/SessionProvider";
import { safeNextPath } from "./safe-next";
import styles from "./login.module.css";

export function LoginScreen() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const expired = params.get("reason") === "expired";
  const { session, signIn } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session.status === "signed_in") router.replace(next);
  }, [session.status, router, next]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    if (result.ok) {
      router.replace(next);
      return;
    }
    setSubmitting(false);
    setError(result.message);
  }

  const noAccess = session.status === "signed_out" && session.reason === "no_access";
  const shownError = error ?? (noAccess ? NO_ACCESS_MESSAGE : null);

  return (
    <main id="main" className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>BookLeaf Support Console</h1>
        <p className={styles.lead}>Sign in to work the author support queue.</p>

        {shownError ? (
          <div ref={errorRef} tabIndex={-1} className={styles.notice}>
            <Notice tone="error">{shownError}</Notice>
          </div>
        ) : expired ? (
          <Notice tone="info" className={styles.notice}>
            Your session expired. Please sign in again.
          </Notice>
        ) : null}

        <form className="bl-form" noValidate onSubmit={onSubmit}>
          <TextField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={submitting}
            required
          />
          <TextField
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            readOnly={submitting}
            required
          />
          <Button type="submit" variant="primary" loading={submitting} loadingLabel="Signing in…">
            Sign in
          </Button>
        </form>

        <p className={styles.help}>
          Accounts are created by BookLeaf. Ask the support lead if you need access.
        </p>
      </div>
    </main>
  );
}
