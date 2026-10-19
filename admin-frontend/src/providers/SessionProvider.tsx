"use client";
// Session state (FRONTEND_ARCHITECTURE.md section 4, admin/SCREENS.md M1). Same
// rules as the author portal (D-031) with the admin role.
// Signed in means: a Supabase session AND GET /me says role "admin". Any
// other role is signed out with the portal-access message. Route guards are
// UX only; the API enforces access.
import type { MeDto } from "@bookleaf/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, isApiError, setSessionExpiredHandler } from "@/lib/api-client";
import { getSupabase } from "@/lib/supabase";

export const NO_ACCESS_MESSAGE = "This account doesn't have access to the support console.";

export type SignOutReason = "expired" | "no_access";

export type SessionState =
  | { status: "loading" }
  /** Signed in with Supabase, but the API couldn't confirm the profile (offline, 5xx). */
  | { status: "unavailable" }
  | { status: "signed_out"; reason?: SignOutReason }
  | { status: "signed_in"; me: MeDto };

export type SignInResult = { ok: true } | { ok: false; message: string };

interface SessionContextValue {
  session: SessionState;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  /** Re-check an existing session after "unavailable". */
  retry: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

type MeCheck = { ok: true; me: MeDto } | { ok: false; reason: SignOutReason | "unavailable" };

async function checkPortalAccess(): Promise<MeCheck> {
  try {
    const { data: me } = await api.get<MeDto>("/me");
    return me.role === "admin" ? { ok: true, me } : { ok: false, reason: "no_access" };
  } catch (error) {
    if (isApiError(error, "FORBIDDEN")) return { ok: false, reason: "no_access" };
    if (isApiError(error, "UNAUTHENTICATED")) return { ok: false, reason: "expired" };
    return { ok: false, reason: "unavailable" };
  }
}

function signInFailure(status: number | undefined, code: string | undefined): string {
  if (code === "invalid_credentials" || status === 400) return "Email or password is incorrect.";
  if (status === 429) return "Too many sign-in attempts. Please wait a few minutes and try again.";
  return "We couldn't sign you in right now. Please try again.";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const queryClient = useQueryClient();
  const router = useRouter();

  const endSession = useCallback(
    (reason?: SignOutReason) => {
      queryClient.clear(); // nothing from this account stays in memory
      setSession({ status: "signed_out", reason });
    },
    [queryClient],
  );

  /** Confirm a stored session with GET /me (portal role check). */
  const confirm = useCallback(
    async (hasSession: boolean, isCancelled: () => boolean = () => false) => {
      if (!hasSession) return endSession();
      const check = await checkPortalAccess();
      if (isCancelled()) return;
      if (check.ok) return setSession({ status: "signed_in", me: check.me });
      if (check.reason === "unavailable") return setSession({ status: "unavailable" });
      if (check.reason === "no_access") await getSupabase().auth.signOut({ scope: "local" });
      endSession(check.reason);
    },
    [endSession],
  );

  // Supabase reports the stored session (INITIAL_SESSION) and sign-outs,
  // including from other tabs. Its docs advise against calling auth methods
  // inside this callback, so the work runs on the next tick.
  useEffect(() => {
    let cancelled = false;
    const { data: subscription } = getSupabase().auth.onAuthStateChange((event, authSession) => {
      if (event === "INITIAL_SESSION") {
        setTimeout(() => {
          if (!cancelled) void confirm(authSession !== null, () => cancelled);
        }, 0);
      }
      if (event === "SIGNED_OUT") {
        setTimeout(() => {
          queryClient.clear();
          // Keep the reason (expired, no access) when this session already ended here.
          setSession((current) => (current.status === "signed_out" ? current : { status: "signed_out" }));
        }, 0);
      }
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [confirm, queryClient]);

  const retry = useCallback(() => {
    setSession({ status: "loading" });
    void getSupabase()
      .auth.getSession()
      .then(({ data }) => confirm(data.session !== null));
  }, [confirm]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      endSession("expired");
      router.replace("/login?reason=expired");
    });
  }, [endSession, router]);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: signInFailure(error.status, error.code) };
    const check = await checkPortalAccess();
    if (check.ok) {
      setSession({ status: "signed_in", me: check.me });
      return { ok: true };
    }
    await supabase.auth.signOut({ scope: "local" });
    return {
      ok: false,
      message:
        check.reason === "no_access"
          ? NO_ACCESS_MESSAGE
          : "We couldn't sign you in right now. Please try again.",
    };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut({ scope: "local" });
    endSession();
    router.replace("/login");
  }, [endSession, router]);

  const value = useMemo(() => ({ session, signIn, signOut, retry }), [session, signIn, signOut, retry]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

/** The signed-in admin's profile (only inside the guarded console routes). */
export function useMe(): MeDto {
  const { session } = useSession();
  if (session.status !== "signed_in") throw new Error("useMe needs a signed-in session");
  return session.me;
}
