import type { Metadata } from "next";
import { MarketingLanding } from "@/components/landing/marketing-landing";

export const metadata: Metadata = {
  title: "Julow — создаём лендинги и сайты, которые продают",
  description:
    "Разрабатываем конверсионные веб-решения, внедряем AI-ботов и автоматизацию IT-процессов для роста вашего бизнеса.",
  openGraph: {
    title: "Julow — веб-студия",
    description: "Лендинги, сайты, AI-боты и SEO-продвижение.",
    type: "website",
    locale: "ru_RU",
  },
};

/**
 * Главная (маркетинговый лендинг) сознательно НЕ оборачивается в `MobileGate`.
 *
 * Мобильным пользователям важно увидеть сам лендинг и кнопку «скачать APK»;
 * прятать всё за заглушкой == терять конверсию. Mobile-only prompt с APK-CTA
 * остаётся на защищённых маршрутах `(app)/*`, где десктоп-вёрстка (sidebar,
 * таблицы, kanban) реально не помещается на телефоне.
 */
export default function Home() {
  return <MarketingLanding />;
}
