import { ViewTransition } from "react";
import { DashboardsPage } from "@/components/pages/dashboards-page";

export default function Page() {
  return (
    <ViewTransition enter="vt-page" exit="vt-page" default="none">
      <DashboardsPage />
    </ViewTransition>
  );
}
