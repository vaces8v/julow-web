"use client";

import { useAuth } from "@/components/auth/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const AUTH_PATHS = ["/login", "/register"];

function isAuthRoute(pathname: string): boolean {
  return AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Клиентская страховка после `middleware.ts`.
 *
 * Middleware уже:
 *   - 404'ит защищённые маршруты для не-авторизованных
 *   - редиректит авторизованных с /login и /register на /workspace
 *
 * Этот guard нужен только для клиентских переходов состояния
 * (например, авто-логин после регистрации, или внешняя смена auth-state),
 * когда middleware уже не сработает.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && isAuthRoute(pathname)) {
      router.replace("/workspace");
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Промежуточное состояние «у клиента ещё нет user, но cookie была на сервере».
  // Случается редко и кратко (stale access + жив refresh) — показываем дочерний контент,
  // т.к. middleware и pre-fetch уже подтвердили доступ к маршруту.
  return <>{children}</>;
}
