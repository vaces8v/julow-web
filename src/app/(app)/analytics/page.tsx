import { ViewTransition } from "react";
import { AnalyticsPage } from "@/components/pages/analytics-page";

export default function Page() {
  return (
    <ViewTransition enter="vt-page" exit="vt-page" default="none">
      <AnalyticsPage />
    </ViewTransition>
  );
}
