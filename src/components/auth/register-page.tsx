"use client";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert } from "@/components/auth/auth-alert";
import {
  AuthDivider,
  OAuthButtonRow,
  SamlSsoStub,
} from "@/components/auth/auth-social-blocks";
import {
  AuthMethodConflictDialog,
  type ConflictMode,
} from "@/components/auth/auth-method-conflict-dialog";
import { useAuth } from "@/components/auth/auth-context";
import { useI18n } from "@/i18n/context";
import { ApiError } from "@/lib/api-client";
import { registerSchema, type RegisterFormValues } from "@/lib/auth/schemas";
import { Checkbox } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ViewIcon, ViewOffIcon } from "hugeicons-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s as 0 | 1 | 2 | 3;
}

const STRENGTH_COLOR = ["", "bg-[var(--danger)]", "bg-[var(--warning)]", "bg-success"] as const;

/**
 * Регистрация:
 *   - email + пароль (8..128, буква + цифра) + подтверждение + чек условий
 *   - server-side ошибки полей мапятся в RHF.setError
 *   - после успешной регистрации сразу пробуем `login` чтобы пользователь не вводил повторно
 */
export function RegisterPage() {
  const { t } = useI18n();
  const a = t.auth;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register: registerUser, login, isRegistering } = useAuth();

  const strengthLabels = useMemo(
    () => ["", a.strengthWeak, a.strengthFair, a.strengthStrong] as const,
    [a.strengthWeak, a.strengthFair, a.strengthStrong],
  );

  const [showPw, setShowPw] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  /**
   * Модалка конфликта метода. На register'е встречаем только
   * код EMAIL_REGISTERED_VIA_OAUTH: юзер пытается зарегистрироваться
   * email'ом, который уже привязан к OAuth-провайдеру.
   * (password-required попадает только в /login после OAuth callback'а.)
   */
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    mode: ConflictMode;
    provider?: string;
    email?: string;
  }>({ open: false, mode: "oauth-required" });

  const {
    register,
    handleSubmit,
    setError,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
    mode: "onTouched",
  });

  const passwordValue = watch("password");
  const strength = passwordStrength(passwordValue);

  const onSubmit = async (values: RegisterFormValues) => {
    setTopError(null);
    try {
      await registerUser({ email: values.email, password: values.password });
      // Успех: попробуем сразу залогинить пользователя.
      // Если backend требует подтверждения email перед логином — login упадёт,
      // и мы покажем нормальный фоллбэк.
      try {
        await login({
          email: values.email,
          password: values.password,
          isRememberMe: false,
        });
        const next = searchParams.get("redirect") ?? "/workspace";
        router.replace(next);
        router.refresh();
      } catch {
        const redirectParam = searchParams.get("redirect");
        const loginUrl = redirectParam
          ? `/login?notice=registered&redirect=${encodeURIComponent(redirectParam)}`
          : "/login?notice=registered";
        router.replace(loginUrl);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        // EMAIL_REGISTERED_VIA_OAUTH — этот email уже зарегистрирован
        // через Google/GitHub. Регистрация паролем не возможна —
        // показываем модалку с прямым CTA войти через OAuth.
        if (err.code === "EMAIL_REGISTERED_VIA_OAUTH") {
          setConflictDialog({
            open: true,
            mode: "oauth-required",
            provider: err.fieldErrors.provider,
            email: values.email,
          });
          return;
        }
        for (const [field, msg] of Object.entries(err.fieldErrors)) {
          if (field === "email" || field === "password") {
            setError(field as "email" | "password", { type: "server", message: msg });
          }
        }
        if (err.code === "USER_ALREADY_EXISTS") {
          setError("email", {
            type: "server",
            message: "Этот email уже зарегистрирован",
          });
        } else if (Object.keys(err.fieldErrors).length === 0) {
          setTopError(err.detail ?? err.message);
        }
      } else if (err instanceof Error) {
        setTopError(err.message);
      } else {
        setTopError("Не удалось зарегистрироваться");
      }
    }
  };

  const submitting = isSubmitting || isRegistering;

  return (
    <AuthShell title={a.registerTitle} subtitle={a.registerSubtitle}>
      <div className="space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <AuthAlert message={topError} />

          <div className="space-y-1.5">
            <label
              htmlFor="reg-email"
              className="block text-xs font-semibold text-[var(--foreground)]"
            >
              {a.email}
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder={a.placeholderEmail}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "reg-email-error" : undefined}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/60 transition-colors focus:border-accent/70 focus:outline-none aria-invalid:border-[var(--danger)]/60"
              {...register("email")}
            />
            {errors.email && (
              <p id="reg-email-error" className="text-xs text-[var(--danger)]">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="reg-password"
              className="block text-xs font-semibold text-[var(--foreground)]"
            >
              {a.password}
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder={a.placeholderNewPassword}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "reg-password-error" : undefined}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 pr-11 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/60 transition-colors focus:border-accent/70 focus:outline-none aria-invalid:border-[var(--danger)]/60"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? a.hidePassword : a.showPassword}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                {showPw ? (
                  <ViewOffIcon size={17} strokeWidth={1.75} />
                ) : (
                  <ViewIcon size={17} strokeWidth={1.75} />
                )}
              </button>
            </div>

            {passwordValue && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3].map((lvl) => (
                    <div
                      key={lvl}
                      className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                        strength >= lvl ? STRENGTH_COLOR[strength] : "bg-[var(--border)]"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  {strengthLabels[strength]}
                  {strength < 2 ? a.strengthSuffix : ""}
                </p>
              </div>
            )}

            {errors.password && (
              <p id="reg-password-error" className="text-xs text-[var(--danger)]">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="reg-confirm"
              className="block text-xs font-semibold text-[var(--foreground)]"
            >
              {a.confirmPassword}
            </label>
            <input
              id="reg-confirm"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              placeholder={a.placeholderRepeatPassword}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? "reg-confirm-error" : undefined}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/60 transition-colors focus:border-accent/70 focus:outline-none aria-invalid:border-[var(--danger)]/60"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p id="reg-confirm-error" className="text-xs text-[var(--danger)]">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Controller
            control={control}
            name="acceptTerms"
            render={({ field }) => (
              <Checkbox
                isSelected={field.value}
                onChange={(checked) => field.onChange(checked)}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                isInvalid={!!errors.acceptTerms}
                className="items-start gap-2 text-xs text-[var(--muted)]"
              >
                {/* HeroUI v3 Checkbox compound API: визуальный квадрат =
                 *   Control + Indicator (галочка), а текстовая часть = Content.
                 *   Без этого слота квадрат не рендерится — был баг "чекбокс
                 *   не виден" на странице регистрации. */}
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                {/* `.checkbox__content` по умолчанию `flex flex-col`, из-за
                 *   чего каждый инлайн-`span` превращался в отдельный ряд
                 *   («Условия», «и», «Политику» каждый на своей строке).
                 *   Переопределяем слот на `block` + `leading-relaxed` —
                 *   текст льётся как обычный параграф и аккуратно
                 *   переносится по словам. */}
                <Checkbox.Content className="block text-xs leading-relaxed">
                  Я принимаю{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(e) => e.stopPropagation()}
                    className="underline underline-offset-2 transition-colors hover:text-[var(--foreground)]"
                  >
                    {a.terms}
                  </Link>{" "}
                  и{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(e) => e.stopPropagation()}
                    className="underline underline-offset-2 transition-colors hover:text-[var(--foreground)]"
                  >
                    {a.privacy}
                  </Link>
                  .
                </Checkbox.Content>
              </Checkbox>
            )}
          />
          {errors.acceptTerms && (
            <p className="text-xs text-[var(--danger)]">{errors.acceptTerms.message}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 active:scale-[0.99] active:opacity-80 disabled:opacity-50"
          >
            {submitting ? "Создаём…" : a.createAccount}
          </button>
        </form>

        <p className="text-center text-[13px] text-[var(--muted)]">
          {a.haveAccount}{" "}
          <Link
            href={searchParams.get("redirect") ? `/login?redirect=${encodeURIComponent(searchParams.get("redirect")!)}` : "/login"}
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            {a.signIn}
          </Link>
        </p>

        <AuthDivider />
        <OAuthButtonRow />
        <SamlSsoStub />
      </div>

      <AuthMethodConflictDialog
        open={conflictDialog.open}
        onOpenChange={(open) =>
          setConflictDialog((prev) => ({ ...prev, open }))
        }
        mode={conflictDialog.mode}
        provider={conflictDialog.provider}
        email={conflictDialog.email}
      />
    </AuthShell>
  );
}
