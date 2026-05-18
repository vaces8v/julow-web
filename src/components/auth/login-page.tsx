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
import { loginSchema, type LoginFormValues } from "@/lib/auth/schemas";
import { Checkbox } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { QrCode01Icon, ViewIcon, ViewOffIcon } from "hugeicons-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

/**
 * Логин-страница.
 *
 * Архитектура:
 *   - react-hook-form + zod: декларативная валидация, минимум перерендеров
 *   - При успехе: AuthProvider кладёт user в кэш и показывает toast
 *   - При ошибке: server-side field errors прокидываются в RHF через setError;
 *     общая ошибка (AUTHENTICATION_FAILED, ACCOUNT_LOCKED…) — поверх формы
 *   - После успешного входа — редирект на `?redirect=…` или `/workspace` (dashboard)
 */
export function LoginPage() {
  const { t } = useI18n();
  const a = t.auth;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoggingIn } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  /**
   * Состояние модалки конфликта метода входа. Открывается:
   *  - в catch при получении кода EMAIL_REGISTERED_VIA_OAUTH от backend
   *    (юзер ввёл email/password, а почта привязана к Google/GitHub);
   *  - из URL ?error=EMAIL_REGISTERED_VIA_PASSWORD после OAuth callback'а
   *    (юзер пытался войти через OAuth, а почта регистрировалась по паролю).
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
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      // Если юзер пришёл с OAuth-callback'а с ?email=..., предзаполняем
      // этот email в форме — экономим клик, вводится только пароль.
      email: searchParams.get("email") ?? "",
      password: "",
      isRememberMe: false,
    },
    mode: "onTouched",
  });

  // Сообщение от middleware/прошлой страницы (например, после logout)
  // и обработка OAuth callback errors — backend может вернуть redirect
  // /login?error=EMAIL_REGISTERED_VIA_PASSWORD&email=... в случае коллизии.
  useEffect(() => {
    const flash = searchParams.get("notice");
    if (flash === "expired") {
      setTopError("Ваша сессия истекла, войдите снова.");
    }
    const error = searchParams.get("error");
    if (error === "EMAIL_REGISTERED_VIA_PASSWORD") {
      setConflictDialog({
        open: true,
        mode: "password-required",
        email: searchParams.get("email") ?? undefined,
      });
    } else if (error === "EMAIL_REGISTERED_VIA_OAUTH") {
      setConflictDialog({
        open: true,
        mode: "oauth-required",
        provider: searchParams.get("provider") ?? undefined,
        email: searchParams.get("email") ?? undefined,
      });
    }
  }, [searchParams]);

  const onSubmit = async (values: LoginFormValues) => {
    setTopError(null);
    try {
      await login({
        email: values.email,
        password: values.password,
        isRememberMe: values.isRememberMe,
      });
      const next = searchParams.get("redirect") ?? "/workspace";
      // Жёсткий navigate с обновлением — middleware пере-проверит cookies
      router.replace(next);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        // EMAIL_REGISTERED_VIA_OAUTH — юзер ввёл пароль от OAuth-аккаунта.
        // Вместо тихого тоста открываем модалку с чётким CTA "Войти
        // через {provider}" — это превращает тупиковый сценарий в
        // понятный выход.
        if (err.code === "EMAIL_REGISTERED_VIA_OAUTH") {
          setConflictDialog({
            open: true,
            mode: "oauth-required",
            provider: err.fieldErrors.provider,
            email: values.email,
          });
          return;
        }
        // Поля от сервера → в RHF
        for (const [field, msg] of Object.entries(err.fieldErrors)) {
          if (field === "email" || field === "password") {
            setError(field as "email" | "password", { type: "server", message: msg });
          }
        }
        // Топ-ошибки, которые не относятся к конкретному полю
        if (Object.keys(err.fieldErrors).length === 0) {
          setTopError(err.detail ?? err.message);
        }
      } else if (err instanceof Error) {
        setTopError(err.message);
      } else {
        setTopError("Не удалось выполнить вход");
      }
    }
  };

  const submitting = isSubmitting || isLoggingIn;

  return (
    <AuthShell title={a.loginTitle} subtitle={a.loginSubtitle}>
      <div className="space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <AuthAlert message={topError} />

          <div className="space-y-1.5">
            <label
              htmlFor="login-email"
              className="block text-xs font-semibold text-[var(--foreground)]"
            >
              {a.email}
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder={a.placeholderEmail}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/60 transition-colors focus:border-accent/70 focus:outline-none aria-invalid:border-[var(--danger)]/60"
              {...register("email")}
            />
            {errors.email && (
              <p id="login-email-error" className="text-xs text-[var(--danger)]">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[var(--foreground)]"
              >
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
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "login-password-error" : undefined}
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
            {errors.password && (
              <p id="login-password-error" className="text-xs text-[var(--danger)]">
                {errors.password.message}
              </p>
            )}
          </div>

          <Controller
            control={control}
            name="isRememberMe"
            render={({ field }) => (
              <Checkbox
                isSelected={field.value}
                onChange={(checked) => field.onChange(checked)}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                className="items-center gap-2 text-xs text-[var(--muted)]"
              >
                {/* HeroUI v3 compound API: без Control+Indicator+Content
                 *   квадрат чекбокса не рендерится. */}
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Content>Запомнить меня на этом устройстве</Checkbox.Content>
              </Checkbox>
            )}
          />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 active:scale-[0.99] active:opacity-80 disabled:opacity-50"
            >
              {submitting ? "Входим…" : a.signIn}
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
          <Link
            href="/register"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            {a.createOneFree}
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
