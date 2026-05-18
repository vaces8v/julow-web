"use client";

/**
 * InviteRedeemPage — публичная страница ввода кода/токена приглашения в проект.
 *
 * Маршрут: `/invite`.
 *
 * Пользователь может ввести полный токен или короткий код (UI принимает любой
 * непустой текст). После ввода — переход на `/invite/[token]` где уже работает
 * полноценный flow с превью и кнопкой принятия.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { ArrowRight01Icon } from "hugeicons-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { useI18n } from "@/i18n/context";

const COPY = {
  en: {
    title: "Have an invite code?",
    subtitle: "Paste the code or link you've received to join the project.",
    placeholder: "Code or link…",
    submit: "Continue",
    invalid: "Please enter a code or link.",
    backHome: "Back to home",
  },
  ru: {
    title: "Есть код приглашения?",
    subtitle: "Вставьте код или ссылку, которую вам прислали, чтобы войти в проект.",
    placeholder: "Код или ссылка…",
    submit: "Продолжить",
    invalid: "Введите код или ссылку.",
    backHome: "На главную",
  },
  de: {
    title: "Hast du einen Einladungscode?",
    subtitle: "Code oder Link einfügen, um dem Projekt beizutreten.",
    placeholder: "Code oder Link…",
    submit: "Weiter",
    invalid: "Bitte gib einen Code oder Link ein.",
    backHome: "Zur Startseite",
  },
} as const;

/**
 * Извлекает чистый токен из строки. Поддерживает:
 *   - голый токен (32-hex или короткий код, любой регистр);
 *   - полную ссылку `https://.../invite/<token>` или `/invite/<token>`.
 * Возвращает токен в lowercase или null если не распознали.
 */
function parseToken(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Если это URL — пытаемся извлечь последний сегмент после /invite/
  try {
    const url = s.startsWith("http") ? new URL(s) : new URL(s, "http://x.local");
    const path = url.pathname;
    const idx = path.toLowerCase().lastIndexOf("/invite/");
    if (idx >= 0) {
      const tail = path.slice(idx + "/invite/".length).replace(/\/.*/, "");
      if (tail) return tail.toLowerCase();
    }
  } catch {
    // не URL — продолжаем как plain
  }

  // Иначе считаем, что это чистый токен/код.
  return s.toLowerCase();
}

export function InviteRedeemPage() {
  const { locale } = useI18n();
  const T = COPY[locale] ?? COPY.en;
  const router = useRouter();

  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = parseToken(value);
    if (!token) {
      setError(T.invalid);
      return;
    }
    router.push(`/invite/${encodeURIComponent(token)}`);
  };

  return (
    <AuthShell title={T.title} subtitle={T.subtitle}>
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-5 shadow-sm space-y-3"
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder={T.placeholder}
          className="h-11 w-full rounded-xl border border-[var(--border)]/60 bg-[var(--surface-secondary)]/40 px-4 font-mono text-[13.5px] outline-none transition-all focus:border-accent/70 focus:bg-[var(--surface)] focus:ring-2 focus:ring-accent/15"
        />
        {error && <p className="text-[11.5px] text-red-500">{error}</p>}
        <Button color="primary" type="submit" size="md" className="w-full">
          {T.submit}
          <ArrowRight01Icon size={14} strokeWidth={1.8} />
        </Button>
      </form>
      <div className="mt-4 text-center">
        <Link href="/" className="text-[12.5px] text-accent hover:underline">
          {T.backHome}
        </Link>
      </div>
    </AuthShell>
  );
}
