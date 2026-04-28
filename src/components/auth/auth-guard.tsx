"use client";

import { useAuth } from "@/components/auth/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const AUTH_PATHS = ["/login", "/register"];
const PUBLIC_PATHS = ["/"];

function isAuthRoute(pathname: string): boolean {
  return AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p);
}

/**
 * Guards routes based on authentication state:
 * - Protected routes → redirect to /login if not authenticated
 * - Auth routes → redirect to /workspace if already authenticated
 * - Shows a loading spinner while session is being restored
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Authenticated user on login/register → send to workspace
    if (isAuthenticated && isAuthRoute(pathname)) {
      router.replace("/workspace");
      return;
    }

    // Unauthenticated user on protected route → send to login
    if (!isAuthenticated && !isAuthRoute(pathname) && !isPublicRoute(pathname)) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // While restoring session, show minimal loader
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </div>
      </div>
    );
  }

  // Don't render protected content until redirect completes
  if (!isAuthenticated && !isAuthRoute(pathname) && !isPublicRoute(pathname)) {
    return null;
  }

  // Don't render auth pages for authenticated users
  if (isAuthenticated && isAuthRoute(pathname)) {
    return null;
  }

  return <>{children}</>;
}
