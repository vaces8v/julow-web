"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

type SeparatorProps = React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>;

function Separator({ className = "", orientation = "horizontal", decorative = true, ...props }: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={`shrink-0 bg-[var(--border)] ${orientation === "horizontal" ? "h-px w-full" : "h-full w-px"} ${className}`.trim()}
      {...props}
    />
  );
}

export { Separator };
