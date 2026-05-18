"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Корневой QueryProvider.
 *
 * Конфиг по умолчанию:
 *   - retry: 1 — лишний раз не дёргаем бэкенд при transient-ошибках
 *   - refetchOnWindowFocus: false — спокойнее UX, не дёргаем профиль на каждый focus
 *   - staleTime: 30s — баланс между актуальностью и нагрузкой
 *
 * QueryClient создаётся через useState, чтобы не пересоздаваться на каждом рендере.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            gcTime: 5 * 60_000,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
