"use client";

import * as React from "react";

export type SplashPhase = "intro" | "done";

type Ctx = { phase: SplashPhase; dismiss: () => void };

const SplashCtx = React.createContext<Ctx>({ phase: "done", dismiss: () => {} });

const KEY = "julow_splash_v5";

export function SplashProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = React.useState<SplashPhase>("intro");

  React.useLayoutEffect(() => {
    try { if (sessionStorage.getItem(KEY)) setPhase("done"); } catch {}
  }, []);

  const dismiss = React.useCallback(() => {
    setPhase("done");
    try { sessionStorage.setItem(KEY, "1"); } catch {}
  }, []);

  return <SplashCtx.Provider value={{ phase, dismiss }}>{children}</SplashCtx.Provider>;
}

export function useSplash() { return React.useContext(SplashCtx); }
