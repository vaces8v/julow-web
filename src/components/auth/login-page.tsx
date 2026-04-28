"use client";

import { validateEmail, validatePassword } from "@/lib/auth-validation";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  AuthDivider,
  OAuthButtonRow,
  SamlSsoStub,
} from "@/components/auth/auth-social-blocks";
import { useAuth } from "@/components/auth/auth-context";
import { useI18n } from "@/i18n/context";
import { QrCode01Icon, ViewIcon, ViewOffIcon } from "hugeicons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export function LoginPage() {
  const { t } = useI18n();
  const a = t.auth;
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      const eErr = validateEmail(email, a.errors);
      const pErr = validatePassword(password, a.errors);
      setEmailError(eErr);
      setPasswordError(pErr);
      if (eErr || pErr) return;
      setSubmitting(true);
      try {
        await login(email.trim(), password);
        router.push("/workspace");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Login failed";
        setFormError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, a, login, router],
  );

  return (
    <AuthShell title={a.loginTitle} subtitle={a.loginSubtitle}>
      <div className="space-y-4">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/8 px-3.5 py-2.5">
              <p className="text-center text-xs font-medium text-[var(--danger)]">{formError}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-xs font-semibold text-[var(--foreground)]">
              {a.email}
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder={a.placeholderEmail}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              aria-invalid={!!emailError}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/60 transition-colors focus:border-accent/70 focus:outline-none aria-invalid:border-[var(--danger)]/60"
            />
            {emailError && <p className="text-xs text-[var(--danger)]">{emailError}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="block text-xs font-semibold text-[var(--foreground)]">
                {a.password}
              </label>
              <button
                type="button"
                className="text-[11px] text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline"
              >
                {a.forgotPassword}
              </button>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder={a.placeholderPassword}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                }}
                aria-invalid={!!passwordError}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 pr-11 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/60 transition-colors focus:border-accent/70 focus:outline-none aria-invalid:border-[var(--danger)]/60"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? a.hidePassword : a.showPassword}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                {showPw ? <ViewOffIcon size={17} strokeWidth={1.75} /> : <ViewIcon size={17} strokeWidth={1.75} />}
              </button>
            </div>
            {passwordError && <p className="text-xs text-[var(--danger)]">{passwordError}</p>}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 active:scale-[0.99] active:opacity-80 disabled:opacity-50"
            >
              {submitting ? "…" : a.signIn}
            </button>
            <Link
              href="/login/qr"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:border-accent/50 hover:bg-[var(--surface-secondary)] hover:text-accent"
              aria-label={a.signInWithQrAria}
              title={a.signInWithQrTitle}
            >
              <QrCode01Icon size={18} strokeWidth={1.75} />
            </Link>
          </div>
        </form>

        <p className="text-center text-[13px] text-[var(--muted)]">
          {a.noAccount}{" "}
          <Link href="/register" className="font-semibold text-accent underline-offset-2 hover:underline">
            {a.createOneFree}
          </Link>
        </p>

        <AuthDivider />
        <OAuthButtonRow />
        <SamlSsoStub />

        <p className="text-center">
          <button
            type="button"
            onClick={() => router.push("/workspace")}
            className="text-[13px] text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline"
          >
            {a.backToApp}
          </button>
        </p>
      </div>
    </AuthShell>
  );
}
