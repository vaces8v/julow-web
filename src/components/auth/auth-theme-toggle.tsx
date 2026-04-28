"use client";

import { Button } from "@heroui/react";
import { Moon02Icon, Sun03Icon } from "hugeicons-react";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "julow_theme";

export function AuthThemeToggle({ variant = "auth" }: { variant?: "auth" | "landing" }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const stored = localStorage.getItem(STORAGE_KEY) as "light" | "dark" | null;
        if (stored === "light" || stored === "dark") {
          document.documentElement.setAttribute("data-theme", stored);
          document.documentElement.classList.toggle("dark", stored === "dark");
          setIsDark(stored === "dark");
          return;
        }
      } catch {
        /* ignore */
      }
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", initial);
      document.documentElement.classList.toggle("dark", prefersDark);
      setIsDark(prefersDark);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(() => {
    setIsDark((d) => {
      const next = !d;
      const theme = next ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  if (variant === "landing") {
    return (
      <button
        type="button"
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        onClick={toggle}
        className="flex h-full min-h-0 w-9 shrink-0 items-center justify-center rounded-r-[10px] text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_10%,transparent)]"
      >
        {isDark ? (
          <Sun03Icon size={17} strokeWidth={1.85} className="text-[var(--foreground)]" />
        ) : (
          <Moon02Icon size={17} strokeWidth={1.85} className="text-[var(--foreground)]" />
        )}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      isIconOnly
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onPress={toggle}
      className="rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/80 shadow-sm backdrop-blur-sm"
    >
      {isDark ? (
        <Sun03Icon size={18} strokeWidth={1.8} className="text-[var(--foreground)]" />
      ) : (
        <Moon02Icon size={18} strokeWidth={1.8} className="text-[var(--foreground)]" />
      )}
    </Button>
  );
}
