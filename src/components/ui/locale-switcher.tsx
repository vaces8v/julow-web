"use client";

import { useI18n, type Locale } from "@/i18n/context";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const SHORT: Record<Locale, string> = { en: "EN", ru: "RU", de: "DE" };
const LOCALES: Locale[] = ["en", "ru", "de"];

type LocaleSwitcherVariant = "app" | "auth" | "landing";

export function LocaleSwitcher({ variant = "app" }: { variant?: LocaleSwitcherVariant }) {
  const { locale, setLocale, localeLabels } = useI18n();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(168, r.width);
    setMenuPos({
      top: r.bottom + 8,
      left: r.right - width,
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open || variant !== "landing") {
      if (!open) setMenuPos(null);
      return;
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, variant, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const btnCls =
    variant === "landing"
      ? "flex h-full min-h-0 w-9 shrink-0 items-center justify-center rounded-l-[10px] text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_10%,transparent)]"
      : variant === "auth"
        ? "flex h-9 items-center gap-1 rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/80 px-2.5 text-[12px] font-semibold text-[var(--foreground)] shadow-sm backdrop-blur-sm transition-colors hover:bg-[var(--surface-secondary)]"
        : "flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]";

  const menuClassName =
    "min-w-[168px] overflow-hidden rounded-xl border border-[color-mix(in_oklch,var(--border)_55%,transparent)] bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] shadow-[0_16px_48px_-8px_oklch(0%_0_0_/0.22)] backdrop-blur-2xl backdrop-saturate-150 dark:shadow-[0_16px_48px_-8px_oklch(0%_0_0_/0.45)]";

  const menuItems = LOCALES.map((l) => (
    <button
      key={l}
      type="button"
      onClick={() => {
        setLocale(l);
        setOpen(false);
      }}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] ${l === locale ? "font-semibold text-accent" : "text-[var(--foreground)]"}`}
    >
      <span className="w-6 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
        {SHORT[l]}
      </span>
      <span>{localeLabels[l]}</span>
    </button>
  ));

  let menu = null;
  if (open) {
    if (variant === "landing" && menuPos) {
      menu = (
        <div
          ref={menuRef}
          className={`fixed z-[9999] ${menuClassName}`}
          style={{
            top: menuPos.top,
            left: menuPos.left,
            minWidth: menuPos.width,
          }}
        >
          {menuItems}
        </div>
      );
    } else if (variant !== "landing") {
      menu = (
        <div ref={menuRef} className={`absolute right-0 top-full z-50 mt-1.5 ${menuClassName}`}>
          {menuItems}
        </div>
      );
    }
  }

  return (
    <div className={variant === "landing" ? "relative flex h-full min-h-0 items-stretch" : "relative"}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        aria-expanded={open}
        className={btnCls}
      >
        {SHORT[locale]}
      </button>

      {variant === "landing" && menu && typeof document !== "undefined"
        ? createPortal(menu, document.body)
        : menu}
    </div>
  );
}
