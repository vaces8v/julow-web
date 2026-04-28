import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { ConditionalAppShell } from "@/components/conditional-app-shell";
import { AgentationDev } from "@/components/agentation-dev";
import { ClickEffectProvider } from "@/components/click-effect-context";
import { ClickEffectWrapper } from "@/components/click-effect-wrapper";
import { SplashProvider } from "@/components/splash-context";
import { SplashScreen } from "@/components/splash-screen";
import { I18nProvider } from "@/i18n/context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Julow PM Web",
  description: "MVP Project Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable}`}
      data-theme="light"
    >
      <body>
        {/*
         * SplashProvider must wrap AppShell so both the SplashScreen and
         * the sidebar brand can read the same phase state.
         * SplashScreen sits OUTSIDE AppShell (fixed overlay, z-9999)
         * so it covers the entire viewport.
         */}
        <I18nProvider>
          <SplashProvider>
            <SplashScreen />
            <ClickEffectProvider>
              <ConditionalAppShell>{children}</ConditionalAppShell>
              <ClickEffectWrapper />
            </ClickEffectProvider>
          </SplashProvider>
        </I18nProvider>
        {process.env.NODE_ENV === "development" ? <AgentationDev /> : null}
      </body>
    </html>
  );
}
