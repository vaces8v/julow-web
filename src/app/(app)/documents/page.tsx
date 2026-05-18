import { ViewTransition } from "react";
import { DocumentsPage } from "@/components/pages/documents-page";

export default function Page() {
  return (
    <ViewTransition enter="vt-page" exit="vt-page" default="none">
      <DocumentsPage />
    </ViewTransition>
  );
}
