/**
 * MobileOnlyPrompt — экран-заглушка для мобильных устройств.
 *
 * Web-версия заточена под десктопы (sidebar, таблицы, kanban, графики),
 * на мобильном UX будет резко хуже. Поэтому на узких экранах вместо
 * приложения показываем экран с приглашением скачать мобильное приложение
 * + iPhone/Android-моки из magicui для визуального якоря.
 */

"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Iphone } from "@/components/ui/iphone";
import { Android } from "@/components/ui/android";
import { useI18n } from "@/i18n/context";

export function MobileOnlyPrompt() {
  const { t } = useI18n();
  const m = t.mobileOnly;

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-black text-white antialiased">
      {/* Decorative gradient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-50 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(99,102,241,0.55) 0%, rgba(168,85,247,0.18) 45%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-200px] right-[-120px] h-[440px] w-[440px] rounded-full opacity-40 blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, rgba(236,72,153,0.55) 0%, rgba(249,115,22,0.18) 50%, transparent 75%)",
        }}
      />

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-between gap-8 px-5 py-10 sm:max-w-xl sm:px-8 sm:py-14">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex w-full items-center justify-center"
        >
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-white/90 transition-opacity hover:opacity-80"
          >
            julow
          </Link>
        </motion.div>

        {/* Phones row */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex w-full items-end justify-center"
        >
          {/* iPhone — спереди по центру */}
          <div className="relative z-20 w-[58%] max-w-[230px] drop-shadow-[0_24px_60px_rgba(99,102,241,0.45)]">
            <Iphone />
          </div>

          {/* Android — позади-справа, чуть меньше и наклонённый */}
          <div
            aria-hidden
            className="absolute right-2 bottom-0 z-10 hidden w-[44%] max-w-[180px] -rotate-[8deg] opacity-75 sm:block"
          >
            <Android width={433} height={882} className="h-auto w-full" />
          </div>

          {/* Android — позади-слева (зеркально) */}
          <div
            aria-hidden
            className="absolute left-2 bottom-0 z-10 hidden w-[44%] max-w-[180px] rotate-[8deg] opacity-75 sm:block"
          >
            <Android width={433} height={882} className="h-auto w-full" />
          </div>
        </motion.div>

        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex w-full flex-col items-center gap-4 text-center"
        >
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur">
            {m.eyebrow}
          </span>
          <h1 className="m-0 text-balance text-[26px] font-bold leading-tight tracking-tight sm:text-[32px]">
            {m.title}
          </h1>
          <p className="m-0 max-w-md text-pretty text-sm leading-relaxed text-white/70 sm:text-base">
            {m.body}
          </p>

          {/* Store buttons (placeholders — пока приложения нет, кнопки disabled) */}
          <div className="mt-2 flex w-full flex-col items-stretch gap-2.5 sm:flex-row sm:justify-center">
            <button
              type="button"
              disabled
              className="group inline-flex items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-left text-white/70 backdrop-blur transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
                <path d="M17.06 12.96c-.03-2.62 2.14-3.88 2.24-3.94-1.22-1.78-3.12-2.03-3.8-2.05-1.62-.16-3.16.95-3.99.95-.83 0-2.1-.93-3.45-.9-1.78.03-3.42 1.03-4.33 2.62-1.85 3.2-.47 7.92 1.33 10.51.88 1.27 1.93 2.7 3.31 2.65 1.33-.05 1.83-.86 3.43-.86 1.6 0 2.05.86 3.45.83 1.43-.03 2.33-1.3 3.2-2.57 1.01-1.47 1.43-2.9 1.45-2.97-.03-.01-2.78-1.07-2.81-4.27ZM14.5 5.05c.74-.9 1.24-2.14 1.1-3.38-1.06.04-2.36.7-3.13 1.6-.69.78-1.3 2.05-1.13 3.27 1.18.09 2.4-.6 3.16-1.49Z" />
              </svg>
              <span className="flex flex-col leading-tight">
                <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                  {m.appStoreEyebrow}
                </span>
                <span className="text-sm font-semibold text-white">
                  {m.appStore}
                </span>
              </span>
            </button>

            <button
              type="button"
              disabled
              className="group inline-flex items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-left text-white/70 backdrop-blur transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
                <path d="M3.61 1.81c-.3.32-.47.81-.47 1.45v17.48c0 .64.17 1.13.47 1.45l.06.06 9.78-9.79v-.23L3.67 1.75l-.06.06ZM17.04 14.61l-3.27-3.28v-.23l3.27-3.27.07.04 3.87 2.2c1.1.63 1.1 1.66 0 2.29l-3.87 2.2-.07.05ZM17.11 14.56 13.78 11.22 3.94 21.06c.36.39.96.43 1.63.06l11.54-6.56" />
                <path d="M17.11 7.78 5.57 1.21c-.67-.38-1.27-.33-1.63.06l9.84 9.84 3.33-3.33Z" />
              </svg>
              <span className="flex flex-col leading-tight">
                <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                  {m.googlePlayEyebrow}
                </span>
                <span className="text-sm font-semibold text-white">
                  {m.googlePlay}
                </span>
              </span>
            </button>
          </div>

          <p className="m-0 mt-3 text-xs text-white/50">{m.comingSoon}</p>
        </motion.div>

        {/* Footer note: можно продолжить на десктопе */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="flex w-full flex-col items-center gap-1 text-center"
        >
          <p className="m-0 text-[11px] uppercase tracking-[0.16em] text-white/40">
            {m.desktopHint}
          </p>
          <p className="m-0 text-xs text-white/60">{m.desktopHintSub}</p>
        </motion.div>
      </main>
    </div>
  );
}
