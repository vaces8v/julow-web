import Link from "next/link";

/**
 * Глобальная 404-страница.
 * Рендерится Next.js при `notFound()` или несуществующем маршруте.
 *
 * Сюда же попадают защищённые маршруты для не-авторизованных пользователей —
 * это ожидаемое поведение (см. `middleware.ts` и `app/_unauthorized/page.tsx`).
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--background)] px-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
          404 · Not Found
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
          Страница не найдена
        </h1>
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Похоже, такой страницы нет — либо у вас нет доступа.
          Попробуйте начать с главной или войти в аккаунт.
        </p>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="h-11 inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-accent/50 hover:bg-[var(--surface-secondary)]"
          >
            На главную
          </Link>
          <Link
            href="/login"
            className="h-11 inline-flex items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
