import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Raleway, Open_Sans, Figtree } from "next/font/google";
import { AgentationDev } from "@/components/agentation-dev";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ClickEffectProvider } from "@/components/click-effect-context";
import { ClickEffectWrapper } from "@/components/click-effect-wrapper";
import { SplashProvider } from "@/components/splash-context";
import { SplashScreen } from "@/components/splash-screen";
import { I18nProvider } from "@/i18n/context";
import { Providers } from "@/components/providers/providers";
import { getServerUser } from "@/lib/server/get-server-user";
import { ThemeScript } from "./theme-script";
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

/* Fonts for the marketing landing (L-web → Julow). Раскладка такая же,
 * как в исходном `landing/app/layout.tsx`, чтобы визуальный ритм
 * текстов (особенно font-display) совпал один в один. */
const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Julow PM Web",
  description: "MVP Project Management Platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Серверный pre-fetch текущего пользователя по access-cookie.
  // Если сессия валидна — Providers сидит React Query сразу, без флэша loading-состояния.
  const initialUser = await getServerUser();

  return (
    /*
     * `suppressHydrationWarning` — обязателен: ThemeScript мутирует
     *   `data-theme`/`class`/`style.colorScheme` на <html> ДО гидратации,
     *   поэтому атрибуты, отрендеренные сервером (без темы), не совпадут
     *   с DOM. React-warning относится только к этому корневому узлу, на
     *   детей он не распространяется.
     */
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${raleway.variable} ${openSans.variable} ${figtree.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* ВАЖНО: скрипт темы должен идти ПЕРВЫМ в <head>, до любого CSS
            и до тегов, которые могут спровоцировать пэйнт. Тогда
            браузер парсит и выполняет его до того, как применит правила
            из globals.css к <body>. */}
        <ThemeScript />
      </head>
      <body suppressHydrationWarning>
        <Providers initialUser={initialUser}>
          <I18nProvider>
            <SplashProvider>
              <SplashScreen />
              <ClickEffectProvider>
                <AuthGuard>{children}</AuthGuard>
                <ClickEffectWrapper />
              </ClickEffectProvider>
            </SplashProvider>
          </I18nProvider>
        </Providers>
        {process.env.NODE_ENV === "development" ? <AgentationDev /> : null}
      </body>
    </html>
  );
}
