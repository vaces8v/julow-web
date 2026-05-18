import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Условия использования · Julow",
  description:
    "Пользовательское соглашение (публичная оферта) сервиса Julow в соответствии с законодательством Российской Федерации, действующим на 2026 год.",
};

export default function TermsPage() {
  return <LegalDocument kind="terms" />;
}
