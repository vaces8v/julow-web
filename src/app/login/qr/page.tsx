import type { Metadata } from "next";
import { QrLoginPageClient } from "@/components/auth/qr-login-page";

export const metadata: Metadata = {
  title: "QR login · Julow",
  description: "Scan a QR code to sign in with your mobile device.",
};

export default function Page() {
  return <QrLoginPageClient />;
}
