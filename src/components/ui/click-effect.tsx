"use client";

import * as React from "react";
import { motion } from "motion/react";
import { createPortal } from "react-dom";

type Item = { id: string; x: number; y: number };

type ClickEffectProps = {
  color?: string;
  size?: number;
  duration?: number;
  scope?: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
};

function ClickEffect({
  color = "oklch(62.04% 0.195 253.83)",
  size = 80,
  duration = 380,
  scope,
  disabled = false,
}: ClickEffectProps) {
  const [items, setItems] = React.useState<Item[]>([]);
  // Откладываем рендер портала до завершения гидратации.
  // Без этого `typeof window`-ветка приводит к hydration mismatch:
  // сервер вставляет `<script id="_R_">`, клиент — `<div>`-портал.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const removeItem = React.useCallback(
    (id: string) => setItems((prev) => prev.filter((it) => it.id !== id)),
    [],
  );

  React.useEffect(() => {
    if (disabled) return;

    const target = scope?.current ?? document;
    const el = target instanceof Document ? document : target;

    function onPointerUp(e: PointerEvent) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      if (!(target instanceof Document)) {
        const rect = (el as HTMLElement).getBoundingClientRect();
        if (
          e.clientX < rect.left || e.clientX > rect.right ||
          e.clientY < rect.top  || e.clientY > rect.bottom
        ) return;
      }

      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setItems((prev) => [...prev, { id, x: e.clientX, y: e.clientY }]);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (el as any).addEventListener("pointerup", onPointerUp, { passive: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => (el as any).removeEventListener("pointerup", onPointerUp);
  }, [scope, disabled]);

  if (!mounted) return null;

  const d = duration / 1000;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
      {items.map((it) => (
        <motion.div
          key={it.id}
          style={{
            position: "fixed",
            left: it.x - size / 2,
            top: it.y - size / 2,
            width: size,
            height: size,
            borderRadius: "50%",
            border: `2px solid ${color}`,
            pointerEvents: "none",
          }}
          initial={{ scale: 0.15, opacity: 0.85 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: d, ease: [0.2, 0, 0.4, 1] }}
          onAnimationComplete={() => removeItem(it.id)}
        />
      ))}
    </div>,
    document.body,
  );
}

export { ClickEffect };
