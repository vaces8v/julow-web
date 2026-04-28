"use client";

import * as React from "react";
import { motion, useSpring, useTransform, type MotionValue, type SpringOptions } from "motion/react";
import useMeasure from "react-use-measure";

/* ─────────────────────────────────────────────────────
 * SlidingNumber
 * Each digit slides vertically with spring physics.
 * Adapted from animate-ui SlidingNumber primitive (MIT)
 * 
 * Usage:
 *   <SlidingNumber value={142} />
 * ───────────────────────────────────────────────────── */

type RollerProps = {
  prevValue: number;
  value: number;
  place: number;
  transition: SpringOptions;
};

function Roller({ prevValue, value, place, transition }: RollerProps) {
  const startDigit = Math.floor(prevValue / place) % 10;
  const targetDigit = Math.floor(value / place) % 10;
  const spring = useSpring(startDigit, transition);

  React.useEffect(() => {
    spring.set(targetDigit);
  }, [targetDigit, spring]);

  const [measureRef, { height }] = useMeasure();

  return (
    <span
      ref={measureRef}
      style={{
        position: "relative",
        display: "inline-block",
        width: "1ch",
        overflowX: "visible",
        overflowY: "clip",
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span style={{ visibility: "hidden" }}>0</span>
      {Array.from({ length: 10 }, (_, i) => (
        <Digit key={i} motionValue={spring} digit={i} height={height} />
      ))}
    </span>
  );
}

function Digit({
  motionValue,
  digit,
  height,
}: {
  motionValue: MotionValue<number>;
  digit: number;
  height: number;
}) {
  const y = useTransform(motionValue, (latest) => {
    if (!height) return 0;
    const current = latest % 10;
    const offset = (10 + digit - current) % 10;
    let ty = offset * height;
    if (offset > 5) ty -= 10 * height;
    return ty;
  });

  if (!height) return <span style={{ visibility: "hidden", position: "absolute" }}>{digit}</span>;

  return (
    <motion.span
      style={{
        y,
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {digit}
    </motion.span>
  );
}

type SlidingNumberProps = {
  value: number;
  transition?: SpringOptions;
  className?: string;
};

function SlidingNumber({
  value,
  transition = { stiffness: 200, damping: 20, mass: 0.4 },
  className,
}: SlidingNumberProps) {
  const absValue = Math.abs(Math.round(value));
  const str = String(absValue);
  const places = React.useMemo(
    () => Array.from({ length: str.length }, (_, i) => Math.pow(10, str.length - i - 1)),
    [str.length],
  );

  const [prev, setPrev] = React.useState(absValue);

  React.useEffect(() => {
    setPrev(absValue);
  }, [absValue]);

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center" }}
      className={className}
    >
      {value < 0 && <span style={{ marginRight: "0.1em" }}>-</span>}
      {places.map((place) => (
        <Roller
          key={place}
          prevValue={prev}
          value={absValue}
          place={place}
          transition={transition}
        />
      ))}
    </span>
  );
}

export { SlidingNumber };
