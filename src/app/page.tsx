import type { Metadata } from "next";
import { MarketingLanding } from "@/components/landing/marketing-landing";
import { MobileGate } from "@/components/landing/mobile-gate";
import { isMobileUserAgent } from "@/lib/server/is-mobile-ua";

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

export default async function Home() {
  // Серверная UA-детекция: мобильные пользователи получают MobileOnlyPrompt
  // сразу, без флэша десктоп-лендинга. На клиенте matchMedia уточняет.
  const defaultIsMobile = await isMobileUserAgent();
  return (
    <MobileGate defaultIsMobile={defaultIsMobile}>
      <MarketingLanding />
    </MobileGate>
  );
}
