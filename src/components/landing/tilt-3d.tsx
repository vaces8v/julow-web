"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

/* ─── Mouse-tracked 3D tilt wrapper ───────────────────────────────
 * Wraps children in a motion.div with perspective + rotateX/rotateY
 * driven by pointer position.  Springs smooth the rotation.
 * ────────────────────────────────────────────────────────────── */

export function Tilt3D({
  children,
  className = "",
  intensity = 8,
  perspective = 1400,
  style,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
  perspective?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rxSpring = useSpring(my, { stiffness: 140, damping: 20, mass: 0.4 });
  const rySpring = useSpring(mx, { stiffness: 140, damping: 20, mass: 0.4 });
  const rX = useTransform(rxSpring, [-0.5, 0.5], [intensity, -intensity]);
  const rY = useTransform(rySpring, [-0.5, 0.5], [-intensity, intensity]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ perspective: `${perspective}px`, ...style }}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <motion.div
        style={{
          rotateX: rX,
          rotateY: rY,
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
