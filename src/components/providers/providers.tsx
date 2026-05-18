"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-context";
import { Toaster } from "@/components/providers/toaster";
import type { AuthUser } from "@/lib/auth/types";

/**
 * Корневые провайдеры приложения.
 *
 * Принимает `initialUser` от серверного layout'а — это позволяет
 * избежать «мигания» loading-состояния при первом рендере: если на сервере
 * валидная сессия, мы сразу засеваем кэш React Query, и AuthProvider
 * стартует уже авторизованным.
 */
export function Providers({
  initialUser,
  children,
}: {
  initialUser: AuthUser | null;
  children: ReactNode;
}) {
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 1,
          refetchOnWindowFocus: false,
          staleTime: 30_000,
          gcTime: 5 * 60_000,
        },
        mutations: { retry: 0 },
      },
    });
    if (initialUser) {
      // Только если действительно есть юзер. Если null — пусть useQuery
      // сходит сам (вдруг access протух, а refresh ещё жив).
      c.setQueryData(["auth", "me"], initialUser);
    }
    return c;
  });

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
