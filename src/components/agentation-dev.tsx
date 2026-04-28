"use client";

import dynamic from "next/dynamic";

const Agentation = dynamic(
  () => import("agentation").then((m) => m.Agentation),
  { ssr: false, loading: () => null },
);

/** Визуальные аннотации для агента (только dev). MCP: `pnpm dev:agentation-mcp` на :4747 */
export function AgentationDev() {
  if (process.env.NODE_ENV !== "development") return null;
  if (!process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT) return null;

  return (
    <Agentation
      endpoint={process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT}
      onSessionCreated={(sessionId) => {
        console.log("[Agentation] session:", sessionId);
      }}
    />
  );
}
