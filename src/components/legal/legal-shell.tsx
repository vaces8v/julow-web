"use client";

import { AuthThemeToggle } from "@/components/auth/auth-theme-toggle";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { useI18n } from "@/i18n/context";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Каркас правовых страниц (Условия / Политика конфиденциальности).
 *
 * Намеренно повторяет заголовок и подвал `AuthShell`, поэтому пользователь,
 * перешедший по ссылке со страницы логина/регистрации, остаётся в том же
 * визуальном контексте (логотип JULOW + переключатель языка + темы).
 *
 * Отличия от `AuthShell`:
 *   - контейнер шире (max-w для длинных юридических текстов);
 *   - убран центральный glow — на длинной странице он мешает;
 *   - `children` рендерится в обычном flow, а не в центрированной форме.
 */
export function LegalShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const a = t.auth;
  const l = t.legal;

  return (
    <div className="relative flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]">
      {/* Subtle ambient glow — top-left only, like auth shell */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(ellipse 65% 45% at 10% 0%, oklch(62% 0.19 253 / 0.10) 0%, transparent 60%)",
        }}
      />

      {/* Top bar — identical to AuthShell */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link
          href="/"
          className="text-[15px] font-black tracking-tight text-[var(--foreground)] no-underline"
          style={{ fontFamily: "var(--font-inter), sans-serif", letterSpacing: "-0.02em" }}
        >
          JULOW
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher variant="auth" />
          <AuthThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 px-4 pb-16 pt-2 sm:px-6">
        <div className="mx-auto w-full max-w-[760px]">{children}</div>
      </main>

      {/* Footer — same copy as AuthShell, links lead to the other document */}
      <footer className="relative z-10 pb-6 text-center text-[11px] text-[var(--muted)]">
        {a.footerLead}{" "}
        <Link
          href="/terms"
          className="underline underline-offset-2 transition-colors hover:text-[var(--foreground)]"
        >
          {a.terms}
        </Link>{" "}
        {a.footerAnd}{" "}
        <Link
          href="/privacy"
          className="underline underline-offset-2 transition-colors hover:text-[var(--foreground)]"
        >
          {a.privacy}
        </Link>
        .
        <span className="mx-2 text-[var(--border)]">·</span>
        <span>{l.jurisdiction}</span>
      </footer>
    </div>
  );
}
