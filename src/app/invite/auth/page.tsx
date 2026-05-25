import { Suspense } from "react";
import { InviteAuthPage } from "@/components/pages/invite-auth-page";

export default function Page() {
  return (
    <Suspense>
      <InviteAuthPage />
    </Suspense>
  );
}
