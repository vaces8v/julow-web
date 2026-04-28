import { ViewTransition } from "react";
import { SettingsPage } from "@/components/pages/settings-page";

export default function Page() {
  return (
    <ViewTransition enter="vt-page" exit="vt-page" default="none">
      <SettingsPage />
    </ViewTransition>
  );
}
