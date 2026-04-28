"use client";

import { ClickEffect } from "@/components/ui/click-effect";
import { useClickEffect } from "@/components/click-effect-context";

export function ClickEffectWrapper() {
  const { enabled } = useClickEffect();
  return <ClickEffect disabled={!enabled} />;
}
