/**
 * MobileGate — клиентская обёртка, которая показывает MobileOnlyPrompt
 * вместо `children` на узких экранах / мобильных устройствах.
 *
 * - `defaultIsMobile` приходит с сервера через UA-detection. Это даёт
 *   корректный first-paint без флэша десктоп-контента у мобильных
 *   юзеров.
 * - На клиенте дополнительно слушаем `matchMedia` (resize/орientation),
 *   чтобы пользователь не «застрял» в десктоп-вью при ротации
 *   планшета или при подделке UA.
 *
 * Брейкпоинт 768px совпадает с Tailwind `md` — ниже него вёрстка
 * приложения становится зажатой (sidebar складывается, таблицы
 * прокручиваются), поэтому prompt уместнее реальной верстки.
 */

"use client";

import { useEffect, useState } from "react";
import { MobileOnlyPrompt } from "@/components/landing/mobile-only-prompt";

const MOBILE_BREAKPOINT = "(max-width: 767px)";

export function MobileGate({
  defaultIsMobile,
  children,
}: {
  defaultIsMobile: boolean;
  children: React.ReactNode;
}) {
  const [isMobile, setIsMobile] = useState(defaultIsMobile);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(MOBILE_BREAKPOINT);
    const sync = () => setIsMobile(mq.matches);
    // Сразу синхронизируем — UA мог соврать (desktop-mode на iPad).
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (isMobile) return <MobileOnlyPrompt />;
  return <>{children}</>;
}
