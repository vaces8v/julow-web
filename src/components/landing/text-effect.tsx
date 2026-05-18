/**
 * TextEffect — word/char-stagger reveal-эффект для заголовков. Все
 * пресеты построены на opacity+translateY (compositor-only), без blur
 * на child-span'ах, чтобы анимация была дешёвой на CPU/GPU даже на
 * мобильных. Используется в Hero, и на каждом sub-page (about/blog/
 * portfolio/schedule/privacy) для главных H1/H2.
 *
 * Скопировано из `landing/components/motion-primitives/text-effect.tsx`,
 * `framer-motion` заменён на `motion/react` (julow-web использует
 * новый именованный package).
 */

"use client";

import React, { type JSX } from "react";
import { motion, type Variants } from "motion/react";

type Preset = "fade-in-blur" | "fade" | "slide" | "scale";
type Per = "word" | "char" | "line";

interface TextEffectProps {
  children: string;
  preset?: Preset;
  per?: Per;
  delay?: number;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}

const presetVariants: Record<Preset, { container: Variants; item: Variants }> = {
  "fade-in-blur": {
    container: {
      hidden: {},
      visible: { transition: { staggerChildren: 0.04 } },
    },
    item: {
      hidden: { opacity: 0, y: 12 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] },
      },
    },
  },
  fade: {
    container: {
      hidden: {},
      visible: { transition: { staggerChildren: 0.04 } },
    },
    item: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.35, ease: "easeOut" } },
    },
  },
  slide: {
    container: {
      hidden: {},
      visible: { transition: { staggerChildren: 0.04 } },
    },
    item: {
      hidden: { opacity: 0, y: 16 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
    },
  },
  scale: {
    container: {
      hidden: {},
      visible: { transition: { staggerChildren: 0.04 } },
    },
    item: {
      hidden: { opacity: 0, scale: 0.85 },
      visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
    },
  },
};

function splitText(text: string, per: Per): string[] {
  if (per === "char") return text.split("");
  if (per === "line") return text.split("\n");
  return text.split(/(\s+)/);
}

export function TextEffect({
  children,
  preset = "fade-in-blur",
  per = "word",
  delay = 0,
  as: Tag = "span",
  className,
}: TextEffectProps) {
  const { container, item } = presetVariants[preset];
  const segments = splitText(children, per);

  const MotionTag = motion[Tag as keyof typeof motion] as typeof motion.span;

  return (
    <MotionTag
      className={className}
      variants={{
        hidden: container.hidden,
        visible: {
          ...container.visible,
          transition: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(container.visible as any)?.transition,
            delayChildren: delay,
          },
        },
      }}
      initial="hidden"
      animate="visible"
    >
      {segments.map((segment, i) => (
        <motion.span
          key={i}
          variants={item}
          style={{
            display: "inline-block",
            whiteSpace: segment === " " ? "pre" : undefined,
            willChange: "opacity, transform",
          }}
        >
          {segment}
        </motion.span>
      ))}
    </MotionTag>
  );
}

export default TextEffect;
