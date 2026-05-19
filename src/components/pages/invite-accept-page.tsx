"use client";

/**
 * InviteAcceptPage — публичная страница принятия приглашения в проект.
 *
 * Маршрут: `/invite/[token]`.
 *
 * Логика:
 *   1. GET `/project-invitations/token/{token}` (не требует auth) → данные приглашения.
 *   2. Показываем preview: проект, статус.
 *   3. Если пользователь не залогинен → CTA «Войти, чтобы принять» с redirect.
 *   4. Если залогинен → POST `/project-invitations/{id}/accept` → редирект в проект.
 *
 * Также страница умеет принимать произвольный токен/код (любой регистр) — без редиректа.
 */

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { ArrowRight01Icon, CheckmarkCircle02Icon, Alert02Icon } from "hugeicons-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { useAuth } from "@/components/auth/auth-context";
import { useI18n } from "@/i18n/context";
import { api, type ProjectInvitationPayload } from "@/lib/api";

const COPY = {
  en: {
    title: "Project invitation",
    subtitle: "Join a Julow project you've been invited to.",
    loading: "Loading invitation…",
    invalidTitle: "Invitation not found",
    invalidDesc: "The link is invalid, has expired, or was revoked.",
    statusPending: "Pending",
    statusAccepted: "Already accepted",
    statusDeclined: "Declined",
    statusExpired: "Expired",
    statusRevoked: "Revoked",
    project: "Project",
    role: "Role",
    accept: "Accept invitation",
    accepting: "Accepting…",
    signInToAccept: "Sign in to accept",
    backHome: "Back to home",
    successTitle: "You're in!",
    successDesc: "Opening the project…",
    errorGeneric: "Failed to accept invitation. Please try again.",
  },
  ru: {
    title: "Приглашение в проект",
    subtitle: "Присоединитесь к проекту Julow, в который вас пригласили.",
    loading: "Загрузка приглашения…",
    invalidTitle: "Приглашение не найдено",
    invalidDesc: "Ссылка недействительна, истекла или была отозвана.",
    statusPending: "Ожидает",
    statusAccepted: "Уже принято",
    statusDeclined: "Отклонено",
    statusExpired: "Истекло",
    statusRevoked: "Отозвано",
    project: "Проект",
    role: "Роль",
    accept: "Принять приглашение",
    accepting: "Принимаем…",
    signInToAccept: "Войти, чтобы принять",
    backHome: "На главную",
    successTitle: "Вы в проекте!",
    successDesc: "Открываем проект…",
    errorGeneric: "Не удалось принять приглашение. Попробуйте ещё раз.",
  },
  de: {
    title: "Projekteinladung",
    subtitle: "Tritt einem Julow-Projekt bei, zu dem du eingeladen wurdest.",
    loading: "Lade Einladung…",
    invalidTitle: "Einladung nicht gefunden",
    invalidDesc: "Der Link ist ungültig, abgelaufen oder wurde widerrufen.",
    statusPending: "Offen",
    statusAccepted: "Bereits angenommen",
    statusDeclined: "Abgelehnt",
    statusExpired: "Abgelaufen",
    statusRevoked: "Widerrufen",
    project: "Projekt",
    role: "Rolle",
    accept: "Einladung annehmen",
    accepting: "Annehmen…",
    signInToAccept: "Anmelden, um anzunehmen",
    backHome: "Zur Startseite",
    successTitle: "Du bist drin!",
    successDesc: "Projekt wird geöffnet…",
    errorGeneric: "Annahme fehlgeschlagen. Bitte erneut versuchen.",
  },
} as const;

export function InviteAcceptPage({
  paramsPromise,
}: {
  paramsPromise: Promise<{ token: string }>;
}) {
  const { token } = use(paramsPromise);
  const { locale } = useI18n();
  const T = COPY[locale] ?? COPY.en;
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [invitation, setInvitation] = useState<ProjectInvitationPayload | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const inv = await api.getProjectInvitationByToken(token);
        if (cancelled) return;
        setInvitation(inv);
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to load invitation:", e);
        setLoadError(e instanceof Error ? e.message : T.invalidDesc);
      } finally {
        if (!cancelled) setLoadingInvite(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, T.invalidDesc]);

  const handleAccept = async () => {
    if (!invitation || !isAuthenticated) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const result = await api.redeemProjectInvitation(token);
      setAccepted(true);
      // даём 800мс пользователю увидеть «You're in!»; используем полный
      // navigate (router.replace + refresh), чтобы AppShell перечитал
      // workspaces (новый guest-workspace мог быть только что добавлен) и
      // открыл проект уже с правильным activeWorkspaceId.
      window.setTimeout(() => {
        router.replace(`/projects/${result.projectId}`);
        router.refresh();
      }, 800);
    } catch (e) {
      console.error("Failed to accept invitation:", e);
      setAcceptError(e instanceof Error ? e.message : T.errorGeneric);
    } finally {
      setAccepting(false);
    }
  };

  // While we still don't know auth state — keep loading
  if (authLoading || loadingInvite) {
    return (
      <AuthShell title={T.title} subtitle={T.subtitle}>
        <div className="flex items-center justify-center py-8 text-[13px] text-[var(--muted)]">
          {T.loading}
        </div>
      </AuthShell>
    );
  }

  if (loadError || !invitation) {
    return (
      <AuthShell title={T.invalidTitle} subtitle={T.invalidDesc}>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-[12.5px] text-red-500">
          {loadError ?? T.invalidDesc}
        </div>
        <div className="mt-4 text-center">
          <Link href="/" className="text-[12.5px] text-accent hover:underline">
            {T.backHome}
          </Link>
        </div>
      </AuthShell>
    );
  }

  const statusLabel: Record<ProjectInvitationPayload["status"], string> = {
    pending: T.statusPending,
    accepted: T.statusAccepted,
    declined: T.statusDeclined,
    expired: T.statusExpired,
    revoked: T.statusRevoked,
  };
  const statusCls: Record<ProjectInvitationPayload["status"], string> = {
    pending: "bg-amber-500/10 text-amber-600",
    accepted: "bg-emerald-500/10 text-emerald-600",
    declined: "bg-red-500/10 text-red-500",
    expired: "bg-[var(--surface-secondary)] text-[var(--muted)]",
    revoked: "bg-[var(--surface-secondary)] text-[var(--muted)]",
  };

  const projectInitial =
    (invitation.projectName ?? "P").trim().slice(0, 1).toUpperCase() || "P";

  return (
    <AuthShell title={T.title} subtitle={T.subtitle}>
      <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-6 space-y-4 shadow-sm">
        {/* Project preview */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-base font-bold text-accent">
            {projectInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[11px] uppercase tracking-wide text-[var(--muted)]">
              {T.project}
            </p>
            <p className="m-0 truncate text-[15px] font-semibold">
              {invitation.projectName ?? invitation.projectId}
            </p>
          </div>
          <span
            className={`rounded-md px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide ${statusCls[invitation.status]}`}
          >
            {statusLabel[invitation.status]}
          </span>
        </div>

        {/* Details */}
        {invitation.email && (
          <div className="rounded-xl border border-[var(--border)]/40 bg-[var(--surface-secondary)]/30 px-3 py-2 text-[12px]">
            <span className="text-[var(--muted)]">→ </span>
            <span className="font-medium">{invitation.email}</span>
          </div>
        )}

        {/* Actions */}
        {accepted ? (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-[12.5px] text-emerald-700">
            <CheckmarkCircle02Icon size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <div>
              <p className="m-0 font-semibold">{T.successTitle}</p>
              <p className="m-0 text-[11.5px] text-emerald-600/80">{T.successDesc}</p>
            </div>
          </div>
        ) : invitation.status !== "pending" ? (
          <div className="flex items-start gap-2 rounded-xl border border-[var(--border)]/40 bg-[var(--surface-secondary)]/30 p-3 text-[12.5px] text-[var(--muted)]">
            <Alert02Icon size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <span>{statusLabel[invitation.status]}</span>
          </div>
        ) : !isAuthenticated ? (
          <Link
            href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
            className="block"
          >
            <Button variant="primary" size="md" className="w-full">
              {T.signInToAccept}
              <ArrowRight01Icon size={14} strokeWidth={1.8} />
            </Button>
          </Link>
        ) : (
          <>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onPress={() => void handleAccept()}
              isDisabled={accepting}
            >
              {accepting ? T.accepting : T.accept}
              {!accepting && <ArrowRight01Icon size={14} strokeWidth={1.8} />}
            </Button>
            {acceptError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-[12px] text-red-500">
                <Alert02Icon size={14} strokeWidth={1.8} className="mt-0.5 shrink-0" />
                <span>{acceptError}</span>
              </div>
            )}
            {user && (
              <p className="text-center text-[11px] text-[var(--muted)]">
                {user.email}
              </p>
            )}
          </>
        )}
      </div>
    </AuthShell>
  );
}
