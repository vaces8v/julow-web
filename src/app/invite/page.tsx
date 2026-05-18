import { ViewTransition } from "react";
import { InviteRedeemPage } from "@/components/pages/invite-redeem-page";

export default function Page() {
  return (
    <ViewTransition enter="vt-page" exit="vt-page" default="none">
      <InviteRedeemPage />
    </ViewTransition>
  );
}
