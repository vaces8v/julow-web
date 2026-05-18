/**
 * InView — обёртка над framer/motion-react's useInView, добавляющая
 * семантику `once: true` через локальный state. Используется в каждой
 * секции мигрированного лендинга для in-view-анимаций.
 *
 * Скопировано из `landing/components/ui/in-view.tsx`, путь только
 * нормализован под `@/components/landing/in-view`.
 */

"use client";

import { type ReactNode, useRef, useState } from "react";
import {
  motion,
  useInView,
  type Variant,
  type Transition,
  type UseInViewOptions,
} from "motion/react";

export type InViewProps = {
  children: ReactNode;
  variants?: {
    hidden: Variant;
    visible: Variant;
  };
  transition?: Transition;
  viewOptions?: UseInViewOptions;
  as?: React.ElementType;
  once?: boolean;
};

const defaultVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export function InView({
  children,
  variants = defaultVariants,
  transition,
  viewOptions,
  as = "div",
  once,
}: InViewProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, viewOptions);
  const [isViewed, setIsViewed] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MotionComponent = motion[as as keyof typeof motion] as any;

  return (
    <MotionComponent
      ref={ref}
      initial="hidden"
      onAnimationComplete={() => {
        if (once) setIsViewed(true);
      }}
      animate={isInView || isViewed ? "visible" : "hidden"}
      variants={variants}
      transition={transition}
    >
      {children}
    </MotionComponent>
  );
}
