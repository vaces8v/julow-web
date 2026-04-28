"use client";

import { AuthThemeToggle } from "@/components/auth/auth-theme-toggle";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import type { Translations } from "@/i18n/translations";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  motion,
  useMotionTemplate,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useMemo } from "react";

type LandingCopy = Translations["landing"];

const springScroll = { stiffness: 200, damping: 32, mass: 0.45 };
const navSpring = { type: "spring" as const, stiffness: 400, damping: 26 };

export function LandingNav({ L }: { L: LandingCopy }) {
  const router = useRouter();
  const { scrollY } = useScroll();
  const y = useSpring(scrollY, springScroll);

  /* «Чистое» стекло: больше blur, умеренный saturate, лёгкая подъёмная тень */
  const bgMix = useTransform(y, [0, 100], [42, 62]);
  const blurPx = useTransform(y, [0, 120], [18, 28]);
  const saturate = useTransform(y, [0, 120], [1.12, 1.35]);
  const shadowAlpha = useTransform(y, [0, 80], [0.06, 0.12]);
  const lift = useTransform(y, [0, 80], [0, -2]);
  const lineScale = useTransform(y, [0, 140], [0.35, 1]);
  const lineGlow = useTransform(y, [0, 100], [0.35, 0.95]);

  const backdropFilter = useMotionTemplate`blur(${blurPx}px) saturate(${saturate})`;
  const backgroundColor = useMotionTemplate`color-mix(in oklch, var(--background) ${bgMix}%, transparent)`;
  const boxShadow = useMotionTemplate`0 ${lift}px 44px -14px oklch(0% 0 0 / ${shadowAlpha}), inset 0 1px 0 0 color-mix(in oklch, var(--foreground) 8%, transparent)`;

  const links = useMemo(
    () =>
      [
        { href: "#features", label: L.navFeatures },
        { href: "#showcase", label: "Showcase" },
        { href: "#story", label: "Story" },
      ] as const,
    [L.navFeatures],
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 pb-1 sm:px-5 sm:pt-4 sm:pb-2">
      <motion.div
        className="relative w-full max-w-3xl overflow-visible rounded-[1.35rem] ring-1 ring-inset ring-[color-mix(in_oklch,var(--border)_28%,transparent)] sm:max-w-4xl sm:rounded-[1.5rem]"
        style={{
          backgroundColor,
          backdropFilter,
          boxShadow,
        }}
      >
        {/* Clip glow/lines to the same radius as the bar (dropdown stays portaled outside). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.35rem] sm:rounded-[1.5rem]"
        >
          <motion.div
            className="absolute inset-x-4 bottom-0 h-px origin-center rounded-full sm:inset-x-6"
            style={{
              scaleX: lineScale,
              opacity: lineGlow,
              background:
                "linear-gradient(90deg, transparent 0%, color-mix(in oklch, var(--accent) 75%, transparent) 45%, color-mix(in oklch, var(--focus) 55%, transparent) 55%, transparent 100%)",
            }}
          />

          <motion.div
            className="absolute inset-x-0 bottom-0 h-px opacity-30 mix-blend-overlay dark:opacity-15"
            animate={{ backgroundPosition: ["120% 0", "-20% 0"] }}
            transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            style={{
              background: "linear-gradient(100deg, transparent 0%, white 50%, transparent 100%)",
              backgroundSize: "38% 100%",
            }}
          />
        </div>

        <div className="relative z-[1] grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
          <Link
            href="/"
            className="group flex min-w-0 shrink-0 items-center justify-self-start gap-2 text-[var(--foreground)] no-underline sm:gap-2.5"
          >
            <motion.span
              className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent text-[13px] font-black text-accent-foreground shadow-md shadow-[oklch(62%_0.19_253_/_0.28)] ring-1 ring-white/25 sm:h-9 sm:w-9 sm:text-[14px]"
              whileHover={{ scale: 1.05, rotate: -4 }}
              whileTap={{ scale: 0.96 }}
              transition={navSpring}
            >
              J
              <motion.span
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 to-transparent"
                animate={{ opacity: [0.25, 0.45, 0.25] }}
                transition={{ duration: 3.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              />
            </motion.span>
            <span
              className="truncate text-[15px] font-black tracking-tight sm:text-[16px]"
              style={{ fontFamily: "var(--font-inter), sans-serif", letterSpacing: "-0.02em" }}
            >
              JULOW
            </span>
          </Link>

          <nav className="hidden justify-self-center md:flex">
            <div className="flex items-center gap-5 text-[13px] font-medium text-[var(--muted)] sm:gap-6 sm:text-sm">
              {links.map((item) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  className="group relative py-1 transition-colors hover:text-[var(--foreground)]"
                  whileHover={{ y: -1 }}
                  transition={navSpring}
                >
                  {item.label}
                  <span className="absolute -bottom-0.5 left-1/2 h-px w-[calc(100%-4px)] -translate-x-1/2 origin-center scale-x-0 rounded-full bg-[color-mix(in_oklch,var(--accent)_58%,transparent)] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                </motion.a>
              ))}
            </div>
          </nav>

          <div className="flex shrink-0 items-center justify-self-end gap-2 sm:gap-2.5">
            <div className="flex h-8 shrink-0 items-stretch overflow-visible rounded-[10px] bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] p-px ring-1 ring-[color-mix(in_oklch,var(--border)_40%,transparent)] backdrop-blur-md sm:h-9 sm:rounded-[11px]">
              <LocaleSwitcher variant="landing" />
              <div
                className="my-1.5 w-px shrink-0 self-stretch bg-[color-mix(in_oklch,var(--border)_42%,transparent)]"
                aria-hidden
              />
              <AuthThemeToggle variant="landing" />
            </div>
            <motion.button
              type="button"
              onClick={() => router.push("/login")}
              className="relative flex h-8 items-center overflow-hidden rounded-full bg-[var(--foreground)] px-4 text-[12px] font-semibold text-[var(--background)] ring-1 ring-[var(--border)]/30 sm:h-9 sm:px-5 sm:text-[13px]"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={navSpring}
            >
              <motion.span
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/18 to-transparent"
                animate={{ x: ["-100%", "120%"] }}
                transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, repeatDelay: 4, ease: "easeInOut" }}
              />
              <span className="relative whitespace-nowrap">{L.navSignIn}</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </header>
  );
}
