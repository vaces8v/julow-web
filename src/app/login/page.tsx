import type { Metadata } from "next";
import { LoginPage } from "@/components/auth/login-page";

export const metadata: Metadata = {
  title: "Sign in · Julow",
  description: "Sign in to Julow with email, SSO, or OAuth (preview).",
};

export default function Page() {
  return <LoginPage />;
}
