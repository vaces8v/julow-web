import type { Metadata } from "next";
import { RegisterPage } from "@/components/auth/register-page";

export const metadata: Metadata = {
  title: "Create account · Julow",
  description: "Create a Julow account with email or federated login (preview).",
};

export default function Page() {
  return <RegisterPage />;
}
