/**
 * Глобальное состояние активного чата на текущей вкладке.
 *
 * Зачем: `app-shell.tsx` показывает toast при получении WS-уведомления
 * `notification.created` (включая `chat_message`). Если пользователь
 * сейчас сидит в этом самом чате на странице `/chats`, нет смысла
 * дёргать тоастом — он только что увидит сообщение в ленте чата.
 *
 * Архитектура: тривиальный модульный singleton + pub/sub. Достаточно для
 * того, чтобы `chats-page.tsx` сообщал в `app-shell.tsx`, какой чат
 * активен; в обе стороны компоненты не зависят друг от друга, общаясь
 * только через этот модуль.
 *
 * Использование (chats-page):
 * ```ts
 * useEffect(() => {
 *   setActiveChatId(selectedId || null);
 *   return () => setActiveChatId(null);
 * }, [selectedId]);
 * ```
 *
 * Использование (app-shell):
 * ```ts
 * if (notif.notification_type === "chat_message" &&
 *     notif.data?.chat_id === getActiveChatId()) return;
 * ```
 */

let activeChatId: string | null = null;

export function setActiveChatId(id: string | null): void {
  activeChatId = id;
}

export function getActiveChatId(): string | null {
  return activeChatId;
}
