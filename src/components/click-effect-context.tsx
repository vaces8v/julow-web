"use client";

import * as React from "react";

const STORAGE_KEY = "julow_click_ripple";

type ClickEffectCtx = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
};

const Ctx = React.createContext<ClickEffectCtx>({ enabled: true, setEnabled: () => {} });

export function ClickEffectProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = React.useState(true);

  // Read from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setEnabledState(stored === "true");
    } catch {}
  }, []);

  const setEnabled = React.useCallback((v: boolean) => {
    setEnabledState(v);
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch {}
  }, []);

  return <Ctx.Provider value={{ enabled, setEnabled }}>{children}</Ctx.Provider>;
}

export function useClickEffect() {
  return React.useContext(Ctx);
}
