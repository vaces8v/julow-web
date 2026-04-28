"use client";

import * as React from "react";
import { motion, type Transition, type HTMLMotionProps } from "motion/react";

/* ─────────────────────────────────────────────────────
 * Fade  — mount/unmount + optional inView trigger
 * FadeList — staggered list of Fade wrappers
 * Adapted from animate-ui Fade primitive (MIT)
 * ───────────────────────────────────────────────────── */

type FadeProps = HTMLMotionProps<"div"> & {
  delay?: number;
  duration?: number;
  initialY?: number;
};

function Fade({
  children,
  delay = 0,
  duration = 0.4,
  initialY = 8,
  transition,
  ...props
}: FadeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: initialY }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: initialY / 2 }}
      transition={transition ?? {
        type: "spring",
        stiffness: 280,
        damping: 28,
        delay: delay / 1000,
        duration,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

type FadeListProps = {
  children: React.ReactNode;
  holdDelay?: number;
  initialDelay?: number;
  initialY?: number;
  transition?: Transition;
  className?: string;
};

function FadeList({
  children,
  holdDelay = 60,
  initialDelay = 0,
  initialY = 10,
  transition,
  className,
}: FadeListProps) {
  const items = React.Children.toArray(children);
  return (
    <>
      {items.map((child, i) => (
        <Fade
          key={i}
          delay={initialDelay + i * holdDelay}
          initialY={initialY}
          transition={transition}
          className={className}
        >
          {child as React.ReactNode}
        </Fade>
      ))}
    </>
  );
}

export { Fade, FadeList };
