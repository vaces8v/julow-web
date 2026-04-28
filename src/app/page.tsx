import type { Metadata } from "next";
import { MarketingLanding } from "@/components/landing/marketing-landing";

export const metadata: Metadata = {
  title: "Julow — calm project management for focused teams",
  description:
    "Tasks, chats, documents, and meetings in one workspace. Start free — built for teams who outgrew noisy tools.",
};

export default function Home() {
  return <MarketingLanding />;
}
