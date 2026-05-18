import { ViewTransition } from "react";
import { ProjectBoardPage } from "@/components/pages/project-board-page";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ViewTransition enter="vt-page" exit="vt-page" default="none">
      <ProjectBoardPage paramsPromise={params} />
    </ViewTransition>
  );
}
