import { ViewTransition } from "react";
import { InviteAcceptPage } from "@/components/pages/invite-accept-page";

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return (
    <ViewTransition enter="vt-page" exit="vt-page" default="none">
      <InviteAcceptPage paramsPromise={params} />
    </ViewTransition>
  );
}
