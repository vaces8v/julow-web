import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MobileGate } from "@/components/landing/mobile-gate";
import { LiveMeetingProvider } from "@/components/live-meeting-context";
import { MeetingPip } from "@/components/meeting-pip";
import { getServerUser } from "@/lib/server/get-server-user";
import { isMobileUserAgent } from "@/lib/server/is-mobile-ua";

/**
 * Layout для защищённой части приложения (route group `(app)`).
 *
 * Делает строгую серверную проверку сессии ДО рендера AppShell:
 *   - если access-cookie отсутствует/протух — `notFound()` → Next отдаёт
 *     корневой `not-found.tsx`, который НЕ инкапсулирован в этом layout'е,
 *     поэтому шапка/сайдбар вообще не появляются.
 *   - если cookie валидна — рендерим AppShell и дочерние страницы.
 *
 * Сценарий «нет cookies вообще» отсекается ещё дешевле — в `proxy.ts`,
 * который без сети переписывает запрос на `/_unauthorized`.
 *
 * Mobile-gate: на телефонах AppShell непригоден (sidebar, таблицы, kanban
 * не помещаются). Поэтому если UA или viewport мобильный — показываем
 * MobileOnlyPrompt вместо приложения, не загружая тяжёлые провайдеры.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();
  if (!user) notFound();
  const defaultIsMobile = await isMobileUserAgent();
  return (
    <MobileGate defaultIsMobile={defaultIsMobile}>
      <LiveMeetingProvider>
        <AppShell>{children}</AppShell>
        <MeetingPip />
      </LiveMeetingProvider>
    </MobileGate>
  );
}
