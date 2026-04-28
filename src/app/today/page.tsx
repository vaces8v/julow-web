import { ViewTransition } from "react";
import { TodayPage } from "@/components/pages/today-page";

export default function Page() {
  return (
    <ViewTransition enter="vt-page" exit="vt-page" default="none">
      <div className="flex min-h-0 flex-1 flex-col">
        <TodayPage />
      </div>
    </ViewTransition>
  );
}
