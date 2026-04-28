"use client";

import useMeasure from "react-use-measure";
import {
  ResponsiveContainer,
  type ResponsiveContainerProps,
} from "recharts";

type Props = {
  children: ResponsiveContainerProps["children"];
  className?: string;
};

/**
 * Обёртка над ResponsiveContainer: явные размеры после лейаута (flex/grid/SSR),
 * чтобы Recharts не получал width/height -1. Высота задаётся классами (например h-[220px]).
 */
export function RechartsAuto({ children, className }: Props) {
  const [ref, bounds] = useMeasure();

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: "100%", minWidth: 0 }}
    >
      {bounds.width > 0 && bounds.height > 0 ? (
        <ResponsiveContainer width={bounds.width} height={bounds.height}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
