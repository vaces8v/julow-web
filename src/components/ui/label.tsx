"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

type LabelProps = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>;

function Label({ className = "", ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`.trim()}
      {...props}
    />
  );
}

export { Label };
