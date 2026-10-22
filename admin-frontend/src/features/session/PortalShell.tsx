"use client";
// Frame and guard for the signed-in console routes. The guard is UX only:
// the API checks the token and role on every request.
import { SLOW_SERVER_HINT } from "@bookleaf/shared";
import { AppShell, Button, ErrorState, LoadingState, SignOutIcon, type NavItem } from "@bookleaf/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LiveUpdatesProvider } from "@/providers/LiveUpdatesProvider";
import { useSession } from "@/providers/SessionProvider";

const BRAND = "BookLeaf Support Console";

function navFor(pathname: string): NavItem[] {
  return [{ href: "/tickets", label: "Queue", current: pathname.startsWith("/tickets") }];
}

export function PortalShell({ children }: { children: ReactNode }) {
  const { session, signOut, retry } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (session.status !== "signed_out") return;
    const params = new URLSearchParams();
    if (session.reason === "expired") params.set("reason", "expired");
    if (pathname !== "/tickets") params.set("next", `${pathname}${window.location.search}`);
    const query = params.toString();
    router.replace(query ? `/login?${query}` : "/login");
  }, [session, pathname, router]);

  if (session.status === "unavailable") {
    return (
      <main id="main" className="bl-main">
        <ErrorState
          headingLevel={2}
          title="We couldn't reach BookLeaf."
          description="Check your connection and try again."
          onRetry={retry}
        />
      </main>
    );
  }

  if (session.status !== "signed_in") {
    return (
      <main id="main" className="bl-main">
        <LoadingState label="Checking your session…" slowHint={SLOW_SERVER_HINT} />
      </main>
    );
  }

  return (
    <AppShell
      portal="admin"
      brand={BRAND}
      homeHref="/tickets"
      link={Link}
      nav={navFor(pathname)}
      account={
        <>
          <span className="bl-muted">{session.me.displayName}</span>
          <Button variant="ghost" size="small" icon={<SignOutIcon />} onClick={() => void signOut()}>
            Sign out
          </Button>
        </>
      }
    >
      <LiveUpdatesProvider>{children}</LiveUpdatesProvider>
    </AppShell>
  );
}
