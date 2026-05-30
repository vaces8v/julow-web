"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/context";
import { UserShield01Icon } from "hugeicons-react";

/* ─── Brand icons (inline SVG — no icon-library dependency) ──────────────── */

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.72-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.4s2.04.13 3 .4c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.58C20.56 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0z" />
    </svg>
  );
}

/** Official Yandex app icon paths (yastatic.net, 2021 brand) — same as mobile. */
export function YandexIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M2.04 12c0-5.523 4.476-10 10-10 5.522 0 10 4.477 10 10s-4.478 10-10 10c-5.524 0-10-4.477-10-10z"
        fill="#FC3F1D"
      />
      <path
        d="M13.32 7.666h-.924c-1.694 0-2.585.858-2.585 2.123 0 1.43.616 2.1 1.881 2.959l1.045.704-3.003 4.487H7.49l2.695-4.014c-1.55-1.111-2.42-2.19-2.42-4.015 0-2.288 1.595-3.85 4.62-3.85h3.003v11.868H13.32V7.666z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04C6.15 5.88 4.28 7.04 3.23 8.87 1.11 12.55 2.68 17.98 4.74 20.97c1.01 1.45 2.21 3.09 3.79 3.03 1.52-.06 2.09-.99 3.93-.99 1.83 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.16-1.69 1.64-3.33 1.66-3.42-.04-.01-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56C19.69 5.08 17.5 4.84 16.72 4.79c-2-.16-3.68 1.09-4.57 2.11zm3.38-3.07c.84-1.01 1.4-2.43 1.25-3.83-1.21.05-2.66.81-3.53 1.82-.78.9-1.45 2.34-1.27 3.71 1.34.1 2.72-.69 3.55-1.7z" />
    </svg>
  );
}

/** Активные OAuth-провайдеры (порядок как в mobile: Google → Yandex → GitHub). */
const OAUTH_PROVIDERS = [
  { id: "google" as const, labelKey: "oauthGoogle" as const, Icon: GoogleIcon },
  { id: "yandex" as const, labelKey: "oauthYandex" as const, Icon: YandexIcon },
  { id: "github" as const, labelKey: "oauthGithub" as const, Icon: GitHubIcon },
];

/**
 * Старт OAuth flow для известного провайдера. Реализован по схеме:
 *
 *   1. Frontend  GET  /api/auth/oauth-authorize?provider=google&redirect_uri=...
 *      → BFF проксирует на FastAPI GET /auth/oauth/oauth_google/authorize
 *      → backend возвращает `authorize_url` (https://accounts.google.com/...)
 *
 *   2. Frontend  window.location.assign(authorize_url)
 *      → юзер логинится у провайдера, провайдер редиректит на
 *      `${origin}/oauth/callback?code=...&state=...&provider=...`.
 *
 *   3. Callback-страница `/oauth/callback`:
 *      → POST /api/auth/oauth-login { provider, code, redirectUri }
 *      → BFF проксирует в FastAPI POST /auth/login/oauth, кладёт токены
 *        в httpOnly cookies, возвращает { user };
 *      → callback-страница router.replace("/workspace").
 *
 * `next` сохраняется в sessionStorage и подмешивается в callback после
 * успешного логина (если backend не примет — фоллбэк на /workspace).
 */
async function startOAuth(provider: "google" | "github" | "yandex") {
  if (typeof window === "undefined") return;

  // Куда вернуть юзера после успешного OAuth — сохраняем в sessionStorage,
  // потому что redirect_uri должен быть _точно_ как в провайдер-консоли,
  // и `?next=` его ломает (Google проверяет точное совпадение).
  const next = window.location.pathname + window.location.search;
  try {
    sessionStorage.setItem("oauth.next", next);
    sessionStorage.setItem("oauth.provider", provider);
  } catch {
    // sessionStorage может быть недоступен (private mode на iOS) —
    // не ломаем flow, просто потеряем `next` (юзер пойдёт на /workspace).
  }

  const redirectUri = `${window.location.origin}/oauth/callback`;
  const qs = new URLSearchParams({ provider, redirect_uri: redirectUri });

  try {
    const res = await fetch(`/api/auth/oauth-authorize?${qs.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const json = (await res.json()) as
      | { success: true; data: { authorize_url: string } }
      | { success: false; error: { message?: string } };

    if (!res.ok || !("data" in json)) {
      const msg = ("error" in json && json.error?.message) || "OAuth init failed";
      console.error("[oauth] authorize failed:", msg);
      return;
    }

    window.location.assign(json.data.authorize_url);
  } catch (err) {
    console.error("[oauth] authorize error:", err);
  }
}

function samlStub() {
  if (typeof window !== "undefined") {
    console.info(`[auth stub] OAuth: saml`);
  }
}

/* ─── OAuth buttons — 2×2 grid, centered ────────────────────────────────── */

export function OAuthButtonRow() {
  const { t } = useI18n();
  const a = t.auth;

  return (
    <div className="grid grid-cols-2 gap-2">
      {OAUTH_PROVIDERS.map(({ id, labelKey, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => startOAuth(id)}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)] active:scale-[0.98]"
        >
          <Icon />
          <span className="truncate">{a[labelKey]}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── Enterprise SSO ─────────────────────────────────────────────────────── */

export function SamlSsoStub() {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={samlStub}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[13px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)]"
    >
      <UserShield01Icon size={17} strokeWidth={1.75} className="text-accent" aria-hidden />
      {t.auth.samlSso}
    </button>
  );
}

/* ─── Divider ────────────────────────────────────────────────────────────── */

export function AuthDivider() {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-[var(--border)]" />
      <span className="text-[11px] font-medium uppercase tracking-widest text-[var(--muted)]">
        {t.auth.dividerOr}
      </span>
      <div className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}

/* ─── QR login (compact) ─────────────────────────────────────────────────── */

export function QrLoginStub() {
  const { t } = useI18n();
  const a = t.auth;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--foreground)]">{a.qrCompactTitle}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{a.qrCompactHint}</p>
        </div>
        {/* Mini QR placeholder */}
        <div
          className="grid shrink-0 grid-cols-5 gap-[2px] rounded-md border border-[var(--border)] bg-white p-1.5 dark:bg-[var(--surface-secondary)]"
          aria-hidden
        >
          {Array.from({ length: 25 }, (_, i) => {
            const dark = [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,6,12,18].includes(i);
            return (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-[1px] ${dark ? "bg-[var(--foreground)]" : "bg-transparent"}`}
              />
            );
          })}
        </div>
      </div>
      <Link href="/login/qr" className="mt-2 block text-center text-[11px] font-medium text-accent hover:underline">
        {a.signInWithQrTitle}
      </Link>
    </div>
  );
}
