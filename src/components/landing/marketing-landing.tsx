/**
 * MarketingLanding — корневая страница лендинга. Композит из секций
 * в том же порядке, что и в исходном `landing/app/page.tsx`. ChatWidget
 * загружается динамически без SSR (зависит от window/scroll).
 *
 * Используется как content в `src/app/page.tsx`, который оборачивает её
 * в `MobileGate` (мобильным пользователям показываем `MobileOnlyPrompt`
 * вместо десктоп-вёрстки лендинга).
 */

"use client";

import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Section1 } from "@/components/landing/section1";
import { Section2 } from "@/components/landing/section2";
import { Section3 } from "@/components/landing/section3";
import { Section4 } from "@/components/landing/section4";
import { Section5 } from "@/components/landing/section5";
import { Section6 } from "@/components/landing/section6";
import { Section7 } from "@/components/landing/section7";
import { SectionSEO } from "@/components/landing/section-seo";
import { FAQ } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";

const ChatWidget = dynamic(
  () => import("@/components/landing/chat-widget").then((m) => ({ default: m.ChatWidget })),
  { ssr: false },
);

export function MarketingLanding() {
  return (
    <div className="flex flex-col min-h-full bg-zinc-50 text-zinc-900 relative">
      {/* Gradient glow layer */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-zinc-50 via-zinc-50 via-10% to-sky-400/10" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-full">
        <Navbar />
        <Hero />
        <div className="w-full border-b border-zinc-200/80" />
        <Section1 />
        <div className="w-full border-b border-zinc-200/80" />
        <Section2 />
        <div className="w-full border-b border-zinc-200/80" />
        <Section3 />
        <div className="w-full border-b border-zinc-200/80" />
        <SectionSEO />
        <div className="w-full border-b border-zinc-200/80" />
        <Section4 />
        <div className="w-full border-b border-zinc-200/80" />
        <Section5 />
        <div className="w-full border-b border-zinc-200/80" />
        <Section6 />
        <div className="w-full border-b border-zinc-200/80" />
        <FAQ />
        <div className="w-full border-b border-zinc-200/80" />
        <Section7 />
        <div className="w-full border-b border-zinc-200/80" />
        <Footer />
      </div>

      <ChatWidget />
    </div>
  );
}
