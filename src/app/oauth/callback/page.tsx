"use client";

/**
 * /oauth/callback — финальный шаг OAuth flow.
 *
 * Сюда возвращается провайдер (Google/GitHub/Yandex) после авторизации юзера.
 * Делает следующее:
 *
 *   1. Достаёт `code` из query string. Если есть `error=...` — провайдер
 *      отказал; рендерим сообщение и предлагаем вернуться на /login.
 *   2. Достаёт provider из sessionStorage (положили в `startOAuth`).
 *   3. POST /api/auth/oauth-login { provider, code, redirectUri }.
 *   4. На успех — router.replace(`next` из sessionStorage || /workspace).
 *   5. На ошибку EMAIL_REGISTERED_VIA_PASSWORD — redirect на
 *      /login?error=EMAIL_REGISTERED_VIA_PASSWORD&email=… — там уже есть
 *      обработчик который покажет AuthMethodConflictDialog.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface CallbackError {
  message: string;
  /** Если ошибка из-за неправильного state/code — даём вернуться на /login. */
  showRetry: boolean;
}

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<CallbackError | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const code = searchParams.get("code");
      const errParam = searchParams.get("error");

      // Провайдер отклонил авторизацию (юзер нажал "Cancel" в Google etc.).
      if (errParam) {
        setError({
          message: `OAuth-провайдер отклонил вход: ${searchParams.get("error_description") ?? errParam}`,
          showRetry: true,
        });
        return;
      }

      if (!code) {
        setError({ message: "Нет кода авторизации в callback.", showRetry: true });
        return;
      }

      // Достаём контекст из sessionStorage — мы положили его в startOAuth.
      let provider: string | null = null;
      let next = "/workspace";
      try {
        provider = sessionStorage.getItem("oauth.provider");
        next = sessionStorage.getItem("oauth.next") || "/workspace";
        // Чистим storage сразу — code одноразовый, повторный заход бессмыслен.
        sessionStorage.removeItem("oauth.provider");
        sessionStorage.removeItem("oauth.next");
      } catch {
        // ignore — sessionStorage недоступен (private mode)
      }
      if (!provider) {
        setError({
          message: "Не найдены данные OAuth-сессии. Начните вход заново.",
          showRetry: true,
        });
        return;
      }

      // redirect_uri должен ТОЧНО совпадать с тем, что использовался при
      // получении authorize_url — backend проверит это при exchange'е.
      const redirectUri = `${window.location.origin}/oauth/callback`;

      try {
        const res = await fetch("/api/auth/oauth-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ provider, code, redirectUri }),
          cache: "no-store",
        });

        const json = (await res.json()) as
          | { success: true; data: { user: { email: string } } }
          | {
              success: false;
              error: { code: string; message: string; field?: string | null };
              details?: Array<{ code: string; message: string; field?: string | null }>;
            };

        if (cancelled) return;

        if (res.ok && "data" in json) {
          // Успешный вход — router.refresh() форсирует перечитку cookies
          // в server-components / middleware.
          router.replace(next);
          router.refresh();
          return;
        }

        // Ошибка коллизии метода — backend пока не возвращает этот код,
        // но frontend готов: redirect на /login с error & email,
        // где login-page откроет AuthMethodConflictDialog.
        if ("error" in json && json.error.code === "EMAIL_REGISTERED_VIA_PASSWORD") {
          const email = json.details?.find((d) => d.field === "email")?.message;
          const qs = new URLSearchParams({ error: "EMAIL_REGISTERED_VIA_PASSWORD" });
          if (email) qs.set("email", email);
          router.replace(`/login?${qs.toString()}`);
          return;
        }

        setError({
          message:
            ("error" in json && json.error.message) ||
            "Не удалось завершить вход через OAuth.",
          showRetry: true,
        });
      } catch (e) {
        if (cancelled) return;
        setError({
          message: e instanceof Error ? e.message : "Сетевая ошибка при OAuth-логине.",
          showRetry: true,
        });
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-8 shadow-sm">
        {error ? (
          <>
            <h1 className="text-base font-semibold text-[var(--foreground)]">
              Не удалось войти
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{error.message}</p>
            {error.showRetry && (
              <a
                href="/login"
                className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
              >
                Вернуться ко входу
              </a>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              {/* Простой spinner на CSS — без зависимостей. */}
              <span
                aria-hidden
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
              />
              <h1 className="text-base font-semibold text-[var(--foreground)]">
                Завершаем вход…
              </h1>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Связываемся с провайдером и проверяем сессию. Не закрывайте вкладку.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
