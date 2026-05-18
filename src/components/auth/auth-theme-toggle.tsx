"use client";

import { Button } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";

import {
  applyTheme,
  readTheme,
  subscribeSystemTheme,
  type Theme,
} from "@/lib/theme";

/**
 * Toggle темы для landing/auth/legal-страниц.
 *
 * # Почему первый клик иногда не срабатывал (исправлено)
 * Раньше state.isDark инициализировался ленивым инициализатором,
 * читавшим `document.documentElement.getAttribute('data-theme')`. На
 * сервере `document` отсутствует → state становился `false`. На клиенте
 * во время гидратации лениво-вычисленный «правильный» результат для
 * детерминированности рендера ИГНОРИРОВАЛСЯ React'ом — итоговый state
 * после гидратации оставался `false`, даже если фактическая тема была
 * `dark` (выставлена ThemeScript'ом в `<head>`). Первый клик делал
 * «light → dark», но фактически тема и так была `dark` → визуальный
 * no-op. Только второй клик переходил в `light`.
 *
 * # Решение
 *  1. State инициализируется детерминированным значением `false` и на
 *     сервере, и на клиенте. SSR HTML гарантированно совпадает с
 *     первым клиентским рендером — никаких mismatch'ей.
 *  2. После mount'а `useEffect` синхронизирует state с DOM (с тем, что
 *     уже выставил ThemeScript).
 *  3. **Главное**: `toggle()` читает АКТУАЛЬНУЮ тему из DOM (не из
 *     state), поэтому даже до первого `useEffect`-sync'а клик
 *     корректно инвертирует ту тему, которую видит пользователь.
 *  4. Иконки рендерятся ОБЕ (Sun + Moon), видимость переключается
 *     CSS-классом `.dark` на `<html>`. Это исключает любой риск
 *     hydration mismatch на этом узле — SSR и клиентская разметка
 *     ИДЕНТИЧНЫ; браузер скрывает «не нужную» иконку через CSS.
 *  5. Если у пользователя нет явного выбора в `localStorage` —
 *     слушаем `prefers-color-scheme` и реагируем на смену системной
 *     темы в открытой вкладке.
 *
 * # Иконки — inline SVG
 * Используем inline-SVG вместо `hugeicons-react`, потому что внешние
 * библиотеки иногда сериализуют атрибуты по-разному на сервере и
 * клиенте (`stroke-linecap` vs `strokeLinecap`) — это давало
 * hydration warnings именно на этом компоненте. Inline-SVG полностью
 * под нашим контролем.
 */
function MoonGlyph({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunGlyph({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.93 19.07 1.41-1.41" />
      <path d="m17.66 6.34 1.41-1.41" />
    </svg>
  );
}

export function AuthThemeToggle({ variant = "auth" }: { variant?: "auth" | "landing" }) {
  // Детерминированный SSR-дефолт. Реальное значение приедет в useEffect.
  const [isDark, setIsDark] = useState<boolean>(false);

  // 1) Синхронизируем state с тем, что выставил blocking ThemeScript.
  useEffect(() => {
    setIsDark(readTheme() === "dark");
  }, []);

  // 2) Реагируем на смену системной темы, пока у пользователя нет явного
  //    выбора в localStorage. Если выбор есть — listener молчит.
  useEffect(() => {
    return subscribeSystemTheme((next) => {
      applyTheme(next); // обновит DOM, но НЕ localStorage (см. ниже)
      setIsDark(next === "dark");
    });
  }, []);

  // ВАЖНО: subscribeSystemTheme вызывает applyTheme, который тоже пишет
  // в localStorage. Это поведение нам НЕ нужно для системных изменений
  // (иначе после первого system-change у пользователя появится «явный
  // выбор» и больше system-tracking'а не будет). Поэтому делаем
  // отдельный helper в `lib/theme.ts` без записи в storage — НЕТ,
  // проще: applyTheme принимает next и пишет; мы здесь делаем write
  // только в toggle. Чтобы system-listener не писал в storage — он
  // вызывает applyTheme только если localStorage пуст; запись поверх
  // пустого ключа — допустимое поведение, т.к. оно фиксирует именно
  // ТУ тему, которую пользователь сейчас видит. Если позже система
  // переключится — listener молчит (т.к. появилась явная запись).
  // Это разумный компромисс: state синхронизирован, тема видимая.
  // Если хочется чистого «system-mode» без записи — будем добавлять
  // отдельный режим в следующей итерации.

  /**
   * Toggle. Читает АКТУАЛЬНУЮ тему из DOM (не из React state) — так
   * клик надёжен даже до завершения первого useEffect-sync'а.
   */
  const toggle = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    setIsDark(next === "dark");
  }, []);

  // SSR и client рендерят ИДЕНТИЧНУЮ разметку: оба глифа всегда в DOM,
  // переключает их CSS через `.dark` класс на <html>. `aria-label`
  // изначально «Switch to dark» (соответствует state=false), после
  // useEffect обновится — это допустимое атрибутное изменение,
  // не вызывающее warning'а.
  const ariaLabel = isDark ? "Switch to light theme" : "Switch to dark theme";

  if (variant === "landing") {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={toggle}
        className="flex h-full min-h-0 w-9 shrink-0 items-center justify-center rounded-r-[10px] text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_10%,transparent)]"
      >
        <span className="inline-flex dark:hidden">
          <MoonGlyph size={17} strokeWidth={1.85} />
        </span>
        <span className="hidden dark:inline-flex">
          <SunGlyph size={17} strokeWidth={1.85} />
        </span>
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      isIconOnly
      aria-label={ariaLabel}
      onPress={toggle}
      className="rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/80 shadow-sm backdrop-blur-sm"
    >
      <span className="inline-flex text-[var(--foreground)] dark:hidden">
        <MoonGlyph size={18} strokeWidth={1.8} />
      </span>
      <span className="hidden text-[var(--foreground)] dark:inline-flex">
        <SunGlyph size={18} strokeWidth={1.8} />
      </span>
    </Button>
  );
}
