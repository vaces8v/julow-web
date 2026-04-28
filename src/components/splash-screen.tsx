"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useSplash } from "./splash-context";

const AUTH_PATHS = ["/login", "/register"];

function skipSplash(pathname: string | null): boolean {
  if (pathname == null) return false;
  if (pathname === "/") return true;
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const LETTERS = ["J", "U", "L", "O", "W"];

/* ── SVG waves: grey dotted diagonal lines from bottom-left to top-right
     Each line starts from a different point along the left/bottom edge
     and travels to the right/top edge — all parallel, spaced apart ── */
function SvgWaves() {
  // Each wave: startX, startY on left/bottom edge → endX, endY on right/top edge
  // All lines go bottom-left → top-right at ~30° with gentle sine wobble
  const waves = [
    { sx: -60,  sy: 520, ex: 740,  ey: -20,  amp: 14, freq: 0.004, delay: 0.15 },
    { sx: 120,  sy: 640, ex: 920,  ey: 40,   amp: 18, freq: 0.003, delay: 0.3  },
    { sx: 340,  sy: 660, ex: 1140, ey: 80,   amp: 12, freq: 0.005, delay: 0.5  },
    { sx: 520,  sy: 700, ex: 1320, ey: 120,  amp: 16, freq: 0.004, delay: 0.65 },
    { sx: -20,  sy: 300, ex: 780,  ey: -220, amp: 10, freq: 0.003, delay: 0.4  },
    { sx: 200,  sy: 380, ex: 1000, ey: -140, amp: 15, freq: 0.004, delay: 0.55 },
    { sx: 700,  sy: 720, ex: 1500, ey: 160,  amp: 11, freq: 0.005, delay: 0.8  },
  ];

  function diagPath(sx: number, sy: number, ex: number, ey: number, amp: number, freq: number): string {
    const steps = 120;
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const bx = sx + (ex - sx) * t;
      const by = sy + (ey - sy) * t;
      // perpendicular wobble
      const dx = ey - sy;
      const dy = -(ex - sx);
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const offset = Math.sin(t * Math.PI * 2 * (freq * 1000)) * amp;
      const x = bx + (dx / len) * offset;
      const y = by + (dy / len) * offset;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return `M${pts.join(" L")}`;
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 600"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {waves.map(({ sx, sy, ex, ey, amp, freq, delay }, i) => (
        <motion.path
          key={i}
          d={diagPath(sx, sy, ex, ey, amp, freq)}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 8"
          strokeLinecap="round"
          className="text-[var(--muted)]"
          initial={{ opacity: 0, pathLength: 0 }}
          animate={{ opacity: 0.09, pathLength: 1 }}
          transition={{
            opacity: { duration: 0.8, delay },
            pathLength: { duration: 2.4, delay, ease: [0.22, 1, 0.36, 1] },
          }}
        />
      ))}
    </svg>
  );
}

export function SplashScreen() {
  const pathname = usePathname();
  const { phase, dismiss } = useSplash();
  const [exiting, setExiting] = React.useState(false);
  const skip = skipSplash(pathname);

  React.useLayoutEffect(() => {
    if (skip) dismiss();
  }, [skip, dismiss]);

  React.useEffect(() => {
    if (phase !== "intro") return;
    const id = window.setTimeout(() => setExiting(true), 2000);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (skip) return null;

  const show = phase === "intro" && !exiting;

  return (
    <AnimatePresence onExitComplete={dismiss}>
      {show && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] } }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none"
          style={{ background: "var(--background)" }}
          aria-hidden="true"
        >
          {/* Grey dotted wave lines */}
          <SvgWaves />

          {/* Ambient glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1.2 }}
            transition={{ duration: 2.5, ease: "easeOut" }}
            className="pointer-events-none absolute"
            style={{
              width: "min(600px, 90vw)",
              height: "min(600px, 90vw)",
              background:
                "radial-gradient(ellipse 50% 50% at 50% 50%, oklch(62.04% 0.195 253.83 / 0.07) 0%, transparent 70%)",
            }}
          />

          {/* Centred content */}
          <div className="relative flex flex-col items-center gap-6">
            <div className="flex items-baseline" aria-label="JULOW">
              {LETTERS.map((letter, i) => (
                <motion.span
                  key={letter}
                  initial={{ y: -50, opacity: 0, filter: "blur(10px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 24,
                    delay: 0.2 + i * 0.07,
                  }}
                  className="font-black leading-none"
                  style={{
                    fontSize: "clamp(46px, 8vw, 72px)",
                    color: "var(--foreground)",
                    fontFamily: "var(--font-inter), sans-serif",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.4, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="text-sm font-medium uppercase tracking-[0.22em]"
              style={{ color: "var(--muted)", fontFamily: "var(--font-inter), sans-serif" }}
            >
              Project Management Platform
            </motion.p>
          </div>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-14 flex flex-col items-center gap-2.5"
          >
            <div className="h-[2px] w-32 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "0%" }}
                transition={{ duration: 1.7, delay: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="h-full w-full rounded-full"
                style={{ background: "var(--accent)" }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
