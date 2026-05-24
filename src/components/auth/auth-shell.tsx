"use client";

/**
 * AuthShell — каркас экранов авторизации (login / register / qr-login).
 *
 * Лэйаут (новая версия — full-bleed shader + floating glass panel):
 *   ┌────────────────────────────────────────────┐
 *   │ JULOW                       RU  ☀          │  ← overlay header
 *   │                                            │
 *   │     «Фокусируйтесь    ┌────────────────┐   │
 *   │      на главном»      │  ╔══════════╗  │   │
 *   │      (morphing)       │  ║   form   ║  │   │  ← acrylic glass panel
 *   │                       │  ╚══════════╝  │   │     (поверх шейдера)
 *   │                       │  Terms · Privacy│  │
 *   │                       └────────────────┘   │
 *   │  Workspace для команд.                     │
 *   │  Plan, chat, ship.                         │
 *   └────────────────────────────────────────────┘
 *
 *   Шейдер `AuthShaderHero` теперь растянут на ВЕСЬ viewport
 *   (`absolute inset-0`). Форма — отдельный «акриловый» блок,
 *   плавающий поверх (`backdrop-blur` + полупрозрачный фон + тонкий
 *   border). На lg+ панель прижата к правому краю, на меньших
 *   экранах — по центру.
 *
 * Адаптив:
 *   - <  md:  glass-панель почти на всю ширину, tagline скрыт
 *   - md..lg: панель центрирована
 *   - lg+:    панель прижата к правому краю, морфинг — слева
 */

import { AuthThemeToggle } from "@/components/auth/auth-theme-toggle";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { AuthShaderHero } from "@/components/auth/auth-shader-hero";
import { useI18n } from "@/i18n/context";
import Image from "next/image";
import Link from "next/link";

export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const { t } = useI18n();
  const a = t.auth;

  return (
    <div
      className={[
        "relative bg-[var(--background)] text-[var(--foreground)]",
        // \u00abОдин viewport, всё внутри\u00bb — без скролла страницы целиком,
        // скроллится сама glass-панель (если форма длинная).
        "h-dvh overflow-hidden",
      ].join(" ")}
    >
      {/* ─────────── ШЕЙДЕР НА ВЕСЬ ЭКРАН ─────────── */}
      <AuthShaderHero />

      {/* ─────────── ОВЕРЛЕЙ: JULOW (лево-верх) ───────────
          Белый текст + drop-shadow — читается на любой яркости лучей.
          z-30 — выше формы (тоже z-20), чтобы случайно не оказаться
          под краем panel'а на узких экранах. */}
      <Link
        href="/"
        className="absolute top-5 left-6 z-30 flex items-center gap-2 no-underline drop-shadow-[0_2px_18px_rgba(0,0,0,0.45)] sm:left-10"
      >
        <Image src="/logo.png" alt="Julow" width={28} height={28} className="h-7 w-7 object-contain" />
        <span
          className="text-[15px] font-black tracking-tight text-white"
          style={{
            fontFamily: "var(--font-inter), sans-serif",
            letterSpacing: "-0.02em",
          }}
        >
          JULOW
        </span>
      </Link>

      {/* ─────────── ОВЕРЛЕЙ: контролы (право-верх) ───────────
          Locale switcher + theme toggle. Те же z-30; стилизованы
          в режиме `auth` — у LocaleSwitcher это «glass on glass»,
          которая остаётся читаемой как над шейдером, так и над
          панелью при крайних позициях. */}
      <div className="absolute top-3.5 right-4 z-30 flex items-center gap-2 sm:right-8">
        <LocaleSwitcher variant="auth" />
        <AuthThemeToggle />
      </div>

      {/* ─────────── ПЛАВАЮЩАЯ GLASS-ПАНЕЛЬ С ФОРМОЙ ───────────
          Поведение:
            - lg+ : 2-колоночный grid (пустая левая ячейка под морфинг
                    в шейдере + правая, в которой панель центрируется);
                    панель сидит «по центру правой половины», а не
                    «прижата к правому краю» — выглядит сбалансированно.
            - <lg : один column, панель по центру вьюпорта.
          Высота ограничена `max-h-[calc(100dvh-32px)]` со внутренним
          `overflow-y-auto` — длинная форма (registration + OAuth + SSO)
          скроллится ВНУТРИ панели, не растягивая страницу. */}
      <main className="relative z-20 grid h-full grid-cols-1 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-0 lg:px-0 lg:py-12">
        {/* Пустая левая ячейка нужна только на lg+ — на ней «дышит»
            морфинг шейдера, форма туда не заходит. */}
        <div aria-hidden className="hidden lg:block" />

        {/* Правая ячейка с центрированной панелью. */}
        <div className="flex h-full items-center justify-center lg:p-8 xl:p-10">
        <div
          className={[
            // Размеры панели
            "flex w-full max-w-[440px] flex-col",
            "max-h-[calc(100dvh-32px)] overflow-y-auto",
            // ── АКРИЛ / FROSTED GLASS ──
            // Полупрозрачный фон + умеренное размытие фона + лёгкая
            // saturate-добавка → благодаря шейдеру под спиной панель
            // получает тёплый violet-tint и читается как «акрил из
            // системного UI», а не плоский overlay.
            //
            // Интенсивность подобрана так, чтобы шейдер «дышал» сквозь
            // панель в обеих темах: на светлой панель не получалась
            // молочно-белой плитой, на тёмной — плотным графитовым
            // блоком. blur-xl (12px) вместо 2xl (24px) и bg-opacity 45/35
            // вместо 65/45 дают тот самый «легкий акрил» вместо
            // «толстой матовой стенки».
            "rounded-3xl border border-white/40 bg-white/45 dark:border-white/10 dark:bg-black/35",
            "backdrop-blur-xl backdrop-saturate-150",
            // Глубокая мягкая тень → панель ощущается приподнятой
            // над шейдером, как настоящая стеклянная пластинка.
            "shadow-[0_30px_90px_-24px_rgba(0,0,0,0.55)]",
            // Внутренний паддинг
            "p-6 sm:p-8",
          ].join(" ")}
        >
          {/* Заголовок.
              `mb-5` (20px) вместо прежнего `mb-7` (28px): когда внутри
              формы появляется AuthAlert первым ребёнком, нижний gap
              формируется `space-y-4` (16px). Старая `mb-7` давала
              28-сверху / 16-снизу — алерт выглядел «прибит» к полю
              email. 20-сверху / 16-снизу — визуально сбалансированно
              и без алерта смотрится так же аккуратно. */}
          <div className="mb-5 w-full space-y-1.5 text-center">
            <h1 className="m-0 text-[26px] font-bold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="m-0 text-sm text-[var(--muted)]">{subtitle}</p>
            )}
          </div>

          {/* Форма */}
          <div className="w-full">{children}</div>

          {/* Footer внутри панели — terms + privacy.
              Раньше футер жил на самом низу страницы; теперь, когда
              форма «приподнята» в glass-панели, легче и эстетичнее
              держать юр. ссылки в её основании. */}
          <footer className="mt-7 text-center text-[11px] text-[var(--muted)]">
            {a.footerLead}{" "}
            <Link
              href="/terms"
              className="underline underline-offset-2 transition-colors hover:text-[var(--foreground)]"
            >
              {a.terms}
            </Link>{" "}
            {a.footerAnd}{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 transition-colors hover:text-[var(--foreground)]"
            >
              {a.privacy}
            </Link>
            .
          </footer>
        </div>
        </div>
      </main>
    </div>
  );
}
