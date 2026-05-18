import { ViewTransition } from "react";
import { ProjectsPage } from "@/components/pages/projects-page";

export default function Page() {
  return (
    <ViewTransition enter="vt-page" exit="vt-page" default="none">
      <ProjectsPage />
    </ViewTransition>
  );
}
