"use client";

/**
 * InviteAuthPage — промежуточная страница для неавторизованных пользователей,
 * получивших ссылку-приглашение в проект.
 *
 * Маршрут: `/invite/auth?callback=/invite/{token}`
 *
 * Логика:
 *   1. Читает `callback` из searchParams — это URL, на который нужно вернуть
 *      пользователя после успешной авторизации/регистрации.
 *   2. Показывает сообщение «Сначала войдите или зарегистрируйтесь».
 *   3. Предоставляет две кнопки: «Войти» и «Зарегистрироваться», обе передают
 *      `redirect={callback}` в URL авторизационных страниц.
 *   4. После логина/регистрации пользователь будет автоматически перенаправлен
 *      на страницу принятия приглашения.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight01Icon, UserAdd01Icon } from "hugeicons-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { useI18n } from "@/i18n/context";

const COPY = {
  en: {
    title: "Authentication required",
    subtitle: "You've been invited to a project on Julow.",
    description:
      "To accept this invitation, please sign in to your existing account or create a new one. After that, you'll be redirected back to accept the invitation automatically.",
    signIn: "Sign in",
    register: "Create account",
    noCallback: "No invitation link found. Please use the original link from your email.",
  },
  ru: {
    title: "Требуется авторизация",
    subtitle: "Вас пригласили в проект на Julow.",
    description:
      "Чтобы принять приглашение, войдите в существующий аккаунт или создайте новый. После этого вы будете автоматически перенаправлены для принятия приглашения.",
    signIn: "Войти",
    register: "Создать аккаунт",
    noCallback: "Ссылка приглашения не найдена. Используйте оригинальную ссылку из письма.",
  },
  de: {
    title: "Authentifizierung erforderlich",
    subtitle: "Du wurdest zu einem Projekt auf Julow eingeladen.",
    description:
      "Um die Einladung anzunehmen, melde dich an oder erstelle ein neues Konto. Danach wirst du automatisch zur Annahme der Einladung weitergeleitet.",
    signIn: "Anmelden",
    register: "Konto erstellen",
    noCallback: "Einladungslink nicht gefunden. Bitte verwende den Originallink aus deiner E-Mail.",
  },
} as const;

export function InviteAuthPage() {
  const { locale } = useI18n();
  const T = COPY[locale] ?? COPY.en;
  const searchParams = useSearchParams();

  const callback = searchParams.get("callback");

  if (!callback) {
    return (
      <AuthShell title={T.title} subtitle={T.subtitle}>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-[12.5px] text-amber-600">
          {T.noCallback}
        </div>
      </AuthShell>
    );
  }

  const loginHref = `/login?redirect=${encodeURIComponent(callback)}`;
  const registerHref = `/register?redirect=${encodeURIComponent(callback)}`;

  return (
    <AuthShell title={T.title} subtitle={T.subtitle}>
      <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-6 space-y-5 shadow-sm">
        <div className="flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
            <UserAdd01Icon size={28} strokeWidth={1.6} className="text-accent" />
          </div>
        </div>

        <p className="text-center text-[13px] leading-relaxed text-[var(--muted)]">
          {T.description}
        </p>

        <div className="space-y-3">
          <Link href={loginHref} className="block">
            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 active:scale-[0.99] active:opacity-80"
            >
              {T.signIn}
              <ArrowRight01Icon size={14} strokeWidth={1.8} />
            </button>
          </Link>

          <Link href={registerHref} className="block">
            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-sm font-semibold text-[var(--foreground)] transition-opacity hover:opacity-80 active:scale-[0.99] active:opacity-70"
            >
              {T.register}
              <ArrowRight01Icon size={14} strokeWidth={1.8} />
            </button>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
