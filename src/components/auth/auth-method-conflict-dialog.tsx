"use client";

/**
 * AuthMethodConflictDialog — модалка-предупреждение о коллизии метода
 * входа.
 *
 * Срабатывает в двух случаях:
 *
 *  1. **mode="oauth-required"** — юзер ввёл логин/пароль, но email привязан
 *     к OAuth-провайдеру (Google/GitHub). Backend возвращает код
 *     `EMAIL_REGISTERED_VIA_OAUTH`, провайдер передаётся в
 *     `details: [{field: "provider", message: "google"}]` и парсится
 *     parseBackendError'ом в `fieldErrors.provider`.
 *
 *  2. **mode="password-required"** — юзер кликнул OAuth-кнопку, но email
 *     уже зарегистрирован обычным email+password. Backend возвращает
 *     `EMAIL_REGISTERED_VIA_PASSWORD` (через redirect на /login?error=…).
 *
 * Правильное действие в обоих случаях — единственная primary-кнопка,
 * которая ведёт юзера к корректному способу входа. На неактуальный
 * способ модалка не открывает дверь, чтобы не плодить путаницу.
 *
 * Реальный OAuth-flow ещё не интегрирован — пока CTA "Continue with Google"
 * указывает на /login (где будет полноценный OAuth-redirect когда подключим).
 */

import Link from "next/link";
import { Button } from "@heroui/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/context";
import {
  GoogleIcon,
  GitHubIcon,
} from "@/components/auth/auth-social-blocks";

export type ConflictMode = "oauth-required" | "password-required";

/**
 * Известные нам OAuth-провайдеры. Backend может прислать любую строку,
 * мы fall-back'нем на "OAuth provider" если провайдер неизвестен.
 */
type KnownProvider = "google" | "github";

interface AuthMethodConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ConflictMode;
  /**
   * Имя OAuth-провайдера для режима `oauth-required`. Backend кладёт его
   * в `fieldErrors.provider` (например "google" или "github"). Для режима
   * `password-required` игнорируется.
   */
  provider?: string;
  /** Email, для которого произошёл конфликт — показываем юзеру для контекста. */
  email?: string;
}

/** Канонизирует provider → нижний регистр + проверка известности. */
function normalizeProvider(raw: string | undefined): KnownProvider | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "google" || v === "github") return v;
  return null;
}

/** Заменяет {provider} в i18n-строке. Если plчекxd нет — строка без подстановки. */
function fmt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function AuthMethodConflictDialog({
  open,
  onOpenChange,
  mode,
  provider,
  email,
}: AuthMethodConflictDialogProps) {
  const { t } = useI18n();
  const a = t.auth;

  const isOauthRequired = mode === "oauth-required";
  const known = normalizeProvider(provider);

  /**
   * Имя провайдера для подстановки в i18n. Для известного — Title-case
   * ("Google", "GitHub"); иначе либо переданный raw (если есть), либо
   * generic-fallback из i18n ("OAuth-провайдер").
   */
  const providerLabel = known === "google"
    ? a.oauthGoogle
    : known === "github"
      ? a.oauthGithub
      : provider?.trim() || a.methodConflictGenericProvider;

  const title = fmt(
    isOauthRequired ? a.methodConflictOauthTitle : a.methodConflictPasswordTitle,
    { provider: providerLabel },
  );
  const description = fmt(
    isOauthRequired ? a.methodConflictOauthDesc : a.methodConflictPasswordDesc,
    { provider: providerLabel },
  );
  const ctaLabel = fmt(
    isOauthRequired ? a.methodConflictOauthCta : a.methodConflictPasswordCta,
    { provider: providerLabel },
  );

  /**
   * Куда ведёт primary-кнопка.
   *
   *  - oauth-required + known provider → `/api/auth/oauth/<provider>` (тот
   *    же endpoint, который инициирует OAuth-flow в OAuthButtonRow когда
   *    backend подключит реальный OAuth);
   *  - oauth-required без provider → `/login` (юзер сам выберет правильный);
   *  - password-required → `/login` с email в query, чтобы автоподставить
   *    email в форму.
   */
  const ctaHref = isOauthRequired
    ? known
      ? `/api/auth/oauth/${known}`
      : "/login"
    : email
      ? `/login?email=${encodeURIComponent(email)}`
      : "/login";

  const Icon = known === "google"
    ? GoogleIcon
    : known === "github"
      ? GitHubIcon
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {email && (
          <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--surface-secondary)]/40 px-3 py-2 text-sm">
            <span className="text-[var(--muted)]">Email:</span>{" "}
            <span className="font-medium">{email}</span>
          </div>
        )}

        <DialogFooter>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => onOpenChange(false)}
          >
            {a.methodConflictClose}
          </Button>
          {/*
           * Primary CTA — рендерим как Link, чтобы Next.js взял на себя
           * переход. Стилизация под Button через className, потому что
           * HeroUI Button не принимает href напрямую.
           */}
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
          >
            {Icon && (
              <span className="flex h-4 w-4 items-center justify-center">
                <Icon />
              </span>
            )}
            {ctaLabel}
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
