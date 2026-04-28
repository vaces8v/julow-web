"use client";

import * as React from "react";
import { LOCALES, LOCALE_LABELS, type Locale, type Translations } from "./translations";

type I18nCtx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
  localeLabels: typeof LOCALE_LABELS;
};

const Ctx = React.createContext<I18nCtx>({
  locale: "en",
  setLocale: () => {},
  t: LOCALES.en,
  localeLabels: LOCALE_LABELS,
});

const STORAGE_KEY = "julow_locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>("en");

  React.useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && stored in LOCALES) setLocaleState(stored);
    } catch {}
  }, []);

  const setLocale = React.useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const value = React.useMemo(
    () => ({ locale, setLocale, t: LOCALES[locale], localeLabels: LOCALE_LABELS }),
    [locale, setLocale],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return React.useContext(Ctx);
}

export type { Locale } from "./translations";
