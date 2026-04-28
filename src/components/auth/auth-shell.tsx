"use client";

import { AuthThemeToggle } from "@/components/auth/auth-theme-toggle";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { useI18n } from "@/i18n/context";
import Link from "next/link";

export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const { t } = useI18n();
  const a = t.auth;

  return (
    <div className="relative flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]">
      {/* Subtle ambient glow — top-left only */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 45% at 10% 0%, oklch(62% 0.19 253 / 0.10) 0%, transparent 60%)",
        }}
      />

      {/* Top bar */}
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
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-4 sm:px-6">
        {/* Heading */}
        <div className="mb-8 w-full max-w-[400px] space-y-1.5 text-center">
          <h1 className="m-0 text-[26px] font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="m-0 text-sm text-[var(--muted)]">{subtitle}</p>
          )}
        </div>

        {/* Form area */}
        <div className="w-full max-w-[400px]">{children}</div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 pb-6 text-center text-[11px] text-[var(--muted)]">
        {a.footerLead}{" "}
        <span className="cursor-pointer underline underline-offset-2 hover:text-[var(--foreground)]">
          {a.terms}
        </span>{" "}
        {a.footerAnd}{" "}
        <span className="cursor-pointer underline underline-offset-2 hover:text-[var(--foreground)]">
          {a.privacy}
        </span>
        .
      </footer>
    </div>
  );
}
