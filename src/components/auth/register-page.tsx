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
import { ViewIcon, ViewOffIcon } from "hugeicons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) s++;
  return s as 0 | 1 | 2 | 3;
}

const STRENGTH_COLOR = ["", "bg-[var(--danger)]", "bg-[var(--warning)]", "bg-success"] as const;

export function RegisterPage() {
  const { t } = useI18n();
  const a = t.auth;
  const strengthLabels = useMemo(
    () => ["", a.strengthWeak, a.strengthFair, a.strengthStrong] as const,
    [a.strengthWeak, a.strengthFair, a.strengthStrong],
  );

  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const strength = passwordStrength(password);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setFormSuccess(null);
      const eErr = validateEmail(email, a.errors);
      const pErr = validatePassword(password, a.errors);
      const cErr = password !== confirm ? a.mismatchPassword : null;
      setEmailError(eErr);
      setPasswordError(pErr);
      setConfirmError(cErr);
      if (eErr || pErr || cErr) return;
      setSubmitting(true);
      try {
        await register(email.trim(), password);
        setFormSuccess("Account created! You can now sign in.");
        router.push("/login");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Registration failed";
        setFormError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, confirm, a, register, router],
  );

  return (
    <AuthShell title={a.registerTitle} subtitle={a.registerSubtitle}>
      <div className="space-y-4">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/8 px-3.5 py-2.5">
              <p className="text-center text-xs font-medium text-[var(--danger)]">{formError}</p>
            </div>
          )}
          {formSuccess && (
            <div className="rounded-xl border border-success/30 bg-success/8 px-3.5 py-2.5">
              <p className="text-center text-xs font-medium text-success">{formSuccess}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="block text-xs font-semibold text-[var(--foreground)]">
              {a.email}
            </label>
            <input
              id="reg-email"
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
            <label htmlFor="reg-password" className="block text-xs font-semibold text-[var(--foreground)]">
              {a.password}
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder={a.placeholderNewPassword}
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

            {password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3].map((lvl) => (
                    <div
                      key={lvl}
                      className={`h-1 flex-1 rounded-full transition-colors duration-300 ${strength >= lvl ? STRENGTH_COLOR[strength] : "bg-[var(--border)]"}`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  {strengthLabels[strength]}
                  {strength < 2 ? a.strengthSuffix : ""}
                </p>
              </div>
            )}

            {passwordError && <p className="text-xs text-[var(--danger)]">{passwordError}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-confirm" className="block text-xs font-semibold text-[var(--foreground)]">
              {a.confirmPassword}
            </label>
            <input
              id="reg-confirm"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              placeholder={a.placeholderRepeatPassword}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setConfirmError(null);
              }}
              aria-invalid={!!confirmError}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/60 transition-colors focus:border-accent/70 focus:outline-none aria-invalid:border-[var(--danger)]/60"
            />
            {confirmError && <p className="text-xs text-[var(--danger)]">{confirmError}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 active:scale-[0.99] active:opacity-80 disabled:opacity-50"
          >
            {submitting ? "…" : a.createAccount}
          </button>
        </form>

        <p className="text-center text-[13px] text-[var(--muted)]">
          {a.haveAccount}{" "}
          <Link href="/login" className="font-semibold text-accent underline-offset-2 hover:underline">
            {a.signIn}
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
