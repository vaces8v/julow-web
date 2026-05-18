import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Политика конфиденциальности · Julow",
  description:
    "Политика обработки персональных данных Julow в соответствии с Федеральным законом № 152-ФЗ и нормативными актами Российской Федерации, действующими на 2026 год.",
};

export default function PrivacyPage() {
  return <LegalDocument kind="privacy" />;
}
