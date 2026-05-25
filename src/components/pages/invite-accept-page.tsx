"use client";

/**
 * InviteAcceptPage — публичная страница принятия приглашения в проект.
 *
 * Маршрут: `/invite/[token]`.
 *
 * Многоступенчатый UI с анимацией слайда:
 *   Шаг 1 (auth): если пользователь не авторизован — показываем preview приглашения
 *                  + встроенные табы логин/регистрация прямо на этой странице.
 *   Шаг 2 (accept): после авторизации слайдом переходим к кнопке «Принять приглашение».
 *   Шаг 3 (success): после принятия — анимированное сообщение «Вы в проекте!» → редирект.
 */

import { use, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Checkbox } from "@heroui/react";
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Alert02Icon,
  ViewIcon,
  ViewOffIcon,
} from "hugeicons-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { useAuth } from "@/components/auth/auth-context";
import { AuthDivider, OAuthButtonRow } from "@/components/auth/auth-social-blocks";
import { useI18n } from "@/i18n/context";
import { api, type ProjectInvitationPayload } from "@/lib/api";
import { ApiError } from "@/lib/api-client";

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
    // Auth step
    authTitle: "Sign in to continue",
    authSubtitle: "Log in or create an account to accept this invitation.",
    tabLogin: "Sign in",
    tabRegister: "Create account",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    rememberMe: "Remember me",
    signIn: "Sign in",
    signingIn: "Signing in…",
    createAccount: "Create account",
    creating: "Creating…",
    showPassword: "Show password",
    hidePassword: "Hide password",
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
    // Auth step
    authTitle: "Войдите для продолжения",
    authSubtitle: "Авторизуйтесь или создайте аккаунт, чтобы принять приглашение.",
    tabLogin: "Войти",
    tabRegister: "Регистрация",
    email: "Email",
    password: "Пароль",
    confirmPassword: "Подтвердите пароль",
    rememberMe: "Запомнить меня",
    signIn: "Войти",
    signingIn: "Входим…",
    createAccount: "Создать аккаунт",
    creating: "Создаём…",
    showPassword: "Показать пароль",
    hidePassword: "Скрыть пароль",
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
    // Auth step
    authTitle: "Anmelden zum Fortfahren",
    authSubtitle: "Melde dich an oder erstelle ein Konto, um die Einladung anzunehmen.",
    tabLogin: "Anmelden",
    tabRegister: "Registrieren",
    email: "E-Mail",
    password: "Passwort",
    confirmPassword: "Passwort bestätigen",
    rememberMe: "Angemeldet bleiben",
    signIn: "Anmelden",
    signingIn: "Anmeldung…",
    createAccount: "Konto erstellen",
    creating: "Erstelle…",
    showPassword: "Passwort anzeigen",
    hidePassword: "Passwort verbergen",
  },
} as const;

type Step = "auth" | "accept" | "success";

export function InviteAcceptPage({
  paramsPromise,
}: {
  paramsPromise: Promise<{ token: string }>;
}) {
  const { token } = use(paramsPromise);
  const { locale } = useI18n();
  const T = COPY[locale] ?? COPY.en;
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, login, register: registerUser } = useAuth();

  const [invitation, setInvitation] = useState<ProjectInvitationPayload | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [manualStep, setManualStep] = useState<Step | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  // True if user authenticated via the inline form on this page (needs slide animation)
  const [didInlineAuth, setDidInlineAuth] = useState(false);

  // Compute effective step: manual override wins, otherwise derive from auth state
  const step: Step = manualStep ?? (isAuthenticated ? "accept" : "auth");

  // Auth form state
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirm, setAuthConfirm] = useState("");
  const [authRemember, setAuthRemember] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const slideRef = useRef<HTMLDivElement>(null);
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);

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

  // When user becomes authenticated via inline form, set manual override to "accept"
  // (this also triggers the slide animation from auth → accept)
  useEffect(() => {
    if (isAuthenticated && manualStep === null) {
      // Already derived as "accept" — no action needed
    } else if (isAuthenticated && manualStep === "auth") {
      setManualStep("accept");
    }
  }, [isAuthenticated, manualStep]);

  // Measure container height synchronously before paint to prevent flash
  useLayoutEffect(() => {
    const refs = { auth: step1Ref, accept: step2Ref, success: step3Ref };
    const el = refs[step]?.current;
    if (el) {
      const h = el.scrollHeight;
      if (h > 0) setContainerHeight(h);
    }
  }, [step, authTab, authError, acceptError]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      if (authTab === "login") {
        await login({ email: authEmail, password: authPassword, isRememberMe: authRemember });
      } else {
        if (authPassword !== authConfirm) {
          setAuthError(locale === "ru" ? "Пароли не совпадают" : locale === "de" ? "Passwörter stimmen nicht überein" : "Passwords don't match");
          setAuthSubmitting(false);
          return;
        }
        await registerUser({ email: authEmail, password: authPassword });
        // auto-login after register
        try {
          await login({ email: authEmail, password: authPassword, isRememberMe: false });
        } catch {
          // If auto-login fails (e.g. email verification required), still proceed
        }
      }
      // Mark that user went through inline auth (for slide animation)
      setDidInlineAuth(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setAuthError(err.detail ?? err.message);
      } else if (err instanceof Error) {
        setAuthError(err.message);
      } else {
        setAuthError(locale === "ru" ? "Произошла ошибка" : "An error occurred");
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!invitation || !isAuthenticated) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const result = await api.redeemProjectInvitation(token);
      setManualStep("success");
      window.setTimeout(() => {
        router.replace(`/projects/${result.projectId}`);
        router.refresh();
      }, 1200);
    } catch (e) {
      console.error("Failed to accept invitation:", e);
      setAcceptError(e instanceof Error ? e.message : T.errorGeneric);
    } finally {
      setAccepting(false);
    }
  };

  // Loading state
  if (authLoading || loadingInvite) {
    return (
      <AuthShell title={T.title} subtitle={T.subtitle}>
        <div className="flex items-center justify-center py-8 text-[13px] text-[var(--muted)]">
          {T.loading}
        </div>
      </AuthShell>
    );
  }

  // Error state
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

  // Non-pending invitations — just show status
  if (invitation.status !== "pending") {
    return (
      <AuthShell title={T.title} subtitle={T.subtitle}>
        <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-6 space-y-4 shadow-sm">
          <ProjectPreview
            projectInitial={projectInitial}
            invitation={invitation}
            statusLabel={statusLabel}
            statusCls={statusCls}
            T={T}
          />
          <div className="flex items-start gap-2 rounded-xl border border-[var(--border)]/40 bg-[var(--surface-secondary)]/30 p-3 text-[12.5px] text-[var(--muted)]">
            <Alert02Icon size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <span>{statusLabel[invitation.status]}</span>
          </div>
        </div>
      </AuthShell>
    );
  }

  // ── Compact layout: user was already authenticated on page load ──
  // No slide mechanism needed — just show accept or success directly.
  const useCompactLayout = !didInlineAuth && isAuthenticated;

  if (useCompactLayout) {
    return (
      <AuthShell title={T.title} subtitle={T.subtitle}>
        <div className="rounded-2xl border border-[var(--border)]/40 bg-[var(--surface)] shadow-sm overflow-hidden">
          <div className="p-6 space-y-4">
            {step === "success" ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckmarkCircle02Icon size={32} strokeWidth={1.6} className="text-emerald-500" />
                </div>
                <p className="m-0 text-[16px] font-bold text-emerald-700">{T.successTitle}</p>
                <p className="m-0 text-[12.5px] text-emerald-600/80">{T.successDesc}</p>
              </div>
            ) : (
              <>
                <ProjectPreview
                  projectInitial={projectInitial}
                  invitation={invitation}
                  statusLabel={statusLabel}
                  statusCls={statusCls}
                  T={T}
                />
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
        </div>
      </AuthShell>
    );
  }

  // ── Slide layout: user started unauthenticated, needs auth → accept → success flow ──
  return (
    <AuthShell title={T.title} subtitle={T.subtitle}>
      <div className="rounded-2xl border border-[var(--border)]/40 bg-[var(--surface)] shadow-sm overflow-hidden">
        {/* Slide container */}
        <div
          ref={slideRef}
          className="relative transition-[height] duration-500 ease-in-out overflow-hidden"
          style={{ height: containerHeight ? `${containerHeight}px` : "auto" }}
        >
          <div
            className="flex items-start transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(${step === "auth" ? "0%" : step === "accept" ? "-100%" : "-200%"})` }}
          >
            {/* ─── Step 1: Auth ─── */}
            <div ref={step1Ref} className="w-full shrink-0 p-6 space-y-4">
              <ProjectPreview
                projectInitial={projectInitial}
                invitation={invitation}
                statusLabel={statusLabel}
                statusCls={statusCls}
                T={T}
              />

              <div className="border-t border-[var(--border)]/30 pt-4 space-y-3">
                <p className="m-0 text-center text-[13px] font-semibold">{T.authTitle}</p>
                <p className="m-0 text-center text-[11.5px] text-[var(--muted)]">{T.authSubtitle}</p>

                {/* Tabs */}
                <div className="flex rounded-xl border border-[var(--border)]/40 bg-[var(--surface-secondary)]/30 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAuthTab("login")}
                    className={`flex-1 py-2.5 text-[12px] font-medium transition-all ${
                      authTab === "login"
                        ? "bg-accent/10 text-accent shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {T.tabLogin}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthTab("register")}
                    className={`flex-1 py-2.5 text-[12px] font-medium transition-all border-l border-[var(--border)]/30 ${
                      authTab === "register"
                        ? "bg-accent/10 text-accent shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {T.tabRegister}
                  </button>
                </div>

                {/* Auth form */}
                <form onSubmit={(e) => void handleAuth(e)} className="space-y-3">
                  {authError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11.5px] text-red-500">
                      {authError}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label htmlFor="invite-email" className="block text-[11px] font-semibold text-[var(--foreground)]">
                      {T.email}
                    </label>
                    <input
                      id="invite-email"
                      type="email"
                      autoComplete="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="h-10 w-full rounded-xl border border-[var(--border)]/60 bg-[var(--surface-secondary)]/40 px-3 text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted)]/60 transition-colors focus:border-accent/70 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="invite-password" className="block text-[11px] font-semibold text-[var(--foreground)]">
                      {T.password}
                    </label>
                    <div className="relative">
                      <input
                        id="invite-password"
                        type={showPw ? "text" : "password"}
                        autoComplete={authTab === "login" ? "current-password" : "new-password"}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="h-10 w-full rounded-xl border border-[var(--border)]/60 bg-[var(--surface-secondary)]/40 px-3 pr-10 text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted)]/60 transition-colors focus:border-accent/70 focus:outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? T.hidePassword : T.showPassword}
                        className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                      >
                        {showPw ? <ViewOffIcon size={15} strokeWidth={1.75} /> : <ViewIcon size={15} strokeWidth={1.75} />}
                      </button>
                    </div>
                  </div>

                  {authTab === "register" && (
                    <div className="space-y-1">
                      <label htmlFor="invite-confirm" className="block text-[11px] font-semibold text-[var(--foreground)]">
                        {T.confirmPassword}
                      </label>
                      <input
                        id="invite-confirm"
                        type={showPw ? "text" : "password"}
                        autoComplete="new-password"
                        value={authConfirm}
                        onChange={(e) => setAuthConfirm(e.target.value)}
                        className="h-10 w-full rounded-xl border border-[var(--border)]/60 bg-[var(--surface-secondary)]/40 px-3 text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted)]/60 transition-colors focus:border-accent/70 focus:outline-none"
                        required
                      />
                    </div>
                  )}

                  {authTab === "login" && (
                    <Checkbox
                      isSelected={authRemember}
                      onChange={(checked) => setAuthRemember(!!checked)}
                      className="items-center gap-2 text-xs text-[var(--muted)]"
                    >
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Content>{T.rememberMe}</Checkbox.Content>
                    </Checkbox>
                  )}

                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="h-10 w-full rounded-xl bg-accent text-[13px] font-semibold text-accent-foreground transition-opacity hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
                  >
                    {authTab === "login"
                      ? (authSubmitting ? T.signingIn : T.signIn)
                      : (authSubmitting ? T.creating : T.createAccount)
                    }
                  </button>
                </form>

                <AuthDivider />
                <OAuthButtonRow />
              </div>
            </div>

            {/* ─── Step 2: Accept ─── */}
            <div ref={step2Ref} className="w-full shrink-0 p-6 space-y-4">
              <ProjectPreview
                projectInitial={projectInitial}
                invitation={invitation}
                statusLabel={statusLabel}
                statusCls={statusCls}
                T={T}
              />

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
            </div>

            {/* ─── Step 3: Success ─── */}
            <div ref={step3Ref} className="w-full shrink-0 p-6 space-y-4">
              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckmarkCircle02Icon size={32} strokeWidth={1.6} className="text-emerald-500" />
                </div>
                <p className="m-0 text-[16px] font-bold text-emerald-700">{T.successTitle}</p>
                <p className="m-0 text-[12.5px] text-emerald-600/80">{T.successDesc}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}

/** Reusable project preview block */
function ProjectPreview({
  projectInitial,
  invitation,
  statusLabel,
  statusCls,
  T,
}: {
  projectInitial: string;
  invitation: ProjectInvitationPayload;
  statusLabel: Record<ProjectInvitationPayload["status"], string>;
  statusCls: Record<ProjectInvitationPayload["status"], string>;
  T: { project: string };
}) {
  return (
    <>
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
      {invitation.email && (
        <div className="rounded-xl border border-[var(--border)]/40 bg-[var(--surface-secondary)]/30 px-3 py-2 text-[12px]">
          <span className="text-[var(--muted)]">→ </span>
          <span className="font-medium">{invitation.email}</span>
        </div>
      )}
    </>
  );
}
