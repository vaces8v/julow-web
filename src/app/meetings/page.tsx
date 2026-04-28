import { ViewTransition } from "react";
import { MeetingsPage } from "@/components/pages/meetings-page";

export default function Page() {
  return (
    <ViewTransition enter="vt-page" exit="vt-page" default="none">
      <div className="flex min-h-0 flex-1 flex-col">
        <MeetingsPage />
      </div>
    </ViewTransition>
  );
}
