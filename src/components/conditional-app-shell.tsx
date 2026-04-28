"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/components/auth/auth-context";
import { AuthGuard } from "@/components/auth/auth-guard";

const AUTH_PATHS = ["/login", "/register"];

function isAuthRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Marketing home and auth — no app chrome. */
function isBareMarketingRoute(pathname: string | null): boolean {
  return pathname === "/";
}

export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isBareMarketingRoute(pathname) || isAuthRoute(pathname))
    return (
      <AuthProvider>
        <AuthGuard>{children}</AuthGuard>
      </AuthProvider>
    );
  return (
    <AppShell>
      <AuthGuard>{children}</AuthGuard>
    </AppShell>
  );
}
