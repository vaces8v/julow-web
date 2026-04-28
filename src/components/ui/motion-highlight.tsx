"use client";

import * as React from "react";
import { motion, AnimatePresence, type Transition } from "motion/react";

/* ─────────────────────────────────────────────────────
 * MotionHighlight — animated sliding background pill.
 * Adapted from animate-ui highlight primitive (MIT).
 *
 * Usage:
 *   <MotionHighlight className="rounded-xl bg-surface-secondary" hover>
 *     <MotionHighlightItem value="a"><button>A</button></MotionHighlightItem>
 *     <MotionHighlightItem value="b"><button>B</button></MotionHighlightItem>
 *   </MotionHighlight>
 * ───────────────────────────────────────────────────── */

type Bounds = { top: number; left: number; width: number; height: number };

type HighlightCtx = {
  activeValue: string | null;
  onActivate: (v: string | null) => void;
  setBoundsForValue: (v: string, rect: DOMRect) => void;
  clearBoundsIfEmpty: () => void;
  hover: boolean;
  transition: Transition;
};

const Ctx = React.createContext<HighlightCtx | undefined>(undefined);

function useCtx() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("MotionHighlightItem must be inside MotionHighlight");
  return c;
}

export type MotionHighlightProps = {
  children: React.ReactNode;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (v: string | null) => void;
  hover?: boolean;
  className?: string;
  style?: React.CSSProperties;
  transition?: Transition;
  containerClassName?: string;
};

export function MotionHighlight({
  children,
  value,
  defaultValue,
  onValueChange,
  hover = false,
  className,
  style,
  transition = { type: "spring", stiffness: 350, damping: 35 },
  containerClassName,
}: MotionHighlightProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [activeValue, setActiveValueState] = React.useState<string | null>(
    value ?? defaultValue ?? null,
  );
  const [bounds, setBoundsState] = React.useState<Bounds | null>(null);

  // sync controlled value
  React.useEffect(() => {
    if (value !== undefined) setActiveValueState(value);
  }, [value]);

  const onActivate = React.useCallback(
    (v: string | null) => {
      setActiveValueState(v);
      onValueChange?.(v);
    },
    [onValueChange],
  );

  const setBoundsForValue = React.useCallback((v: string, rect: DOMRect) => {
    if (!containerRef.current) return;
    const cr = containerRef.current.getBoundingClientRect();
    setBoundsState({ top: rect.top - cr.top, left: rect.left - cr.left, width: rect.width, height: rect.height });
  }, []);

  const clearBoundsIfEmpty = React.useCallback(() => setBoundsState(null), []);

  return (
    <Ctx.Provider value={{ activeValue, onActivate, setBoundsForValue, clearBoundsIfEmpty, hover, transition }}>
      <div ref={containerRef} className={`relative ${containerClassName ?? ""}`.trim()}>
        <AnimatePresence initial={false} mode="wait">
          {bounds && (
            <motion.div
              key="highlight"
              data-slot="motion-highlight"
              animate={{ top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height, opacity: 1 }}
              initial={{ top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={transition}
              style={{ position: "absolute", zIndex: 0, pointerEvents: "none", ...style }}
              className={className}
            />
          )}
        </AnimatePresence>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export type MotionHighlightItemProps = {
  value: string;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  disabled?: boolean;
};

export function MotionHighlightItem({ value, children, disabled = false }: MotionHighlightItemProps) {
  const { activeValue, onActivate, setBoundsForValue, clearBoundsIfEmpty, hover } = useCtx();
  const ref = React.useRef<HTMLDivElement>(null);
  const isActive = activeValue === value;

  React.useEffect(() => {
    if (isActive && ref.current) {
      setBoundsForValue(value, ref.current.getBoundingClientRect());
    } else if (!activeValue) {
      clearBoundsIfEmpty();
    }
  }, [isActive, activeValue, value, setBoundsForValue, clearBoundsIfEmpty]);

  const handlers: React.HTMLAttributes<HTMLDivElement> = hover
    ? {
        onMouseEnter: () => { if (!disabled) onActivate(value); },
        onMouseLeave: () => { if (!disabled) onActivate(null); },
      }
    : {
        onClick: () => {
          if (!disabled) onActivate(value);
        },
      };

  return (
    <div
      ref={ref}
      data-active={String(isActive)}
      style={{ position: "relative", zIndex: 1, display: "contents" }}
      {...handlers}
    >
      {children}
    </div>
  );
}
