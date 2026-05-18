/**
 * Julow Web — pub/sub-шина WebSocket-событий (без своего соединения).
 *
 * # Зачем
 *
 * Раньше этот модуль самостоятельно открывал WebSocket к
 * `${WS_BASE}/ws/notifications`. Это давало СВОЙ собственный сокет,
 * параллельный тому, что открывает `useNotificationsSocket` в
 * `app-shell.tsx`. Получалось два соединения на вкладку, и хуже того —
 * базовый URL здесь вычислялся через `deriveWsBaseUrl()` из env-переменных,
 * которые в dev'е могли быть не заданы. В таком случае фолбэк
 * `same-origin` указывал на хост Next.js (`localhost:3000`), а не FastAPI
 * (`localhost:8000`), и соединение тихо умирало.
 *
 * Теперь модуль НЕ держит WS — он только хранит подписчиков и принимает
 * входящие события через `dispatchWsEvent(...)`, который вызывает
 * `useNotificationsSocket.onEvent` в `app-shell.tsx`. Соединение одно
 * на всю вкладку, открывается реальным хуком, который умеет правильно
 * получать URL у бэкенда (`/notifications/connection-info`).
 *
 * # Использование
 *
 * ```ts
 * const unsub = subscribeWsEvent("notification.created", (payload) => { ... });
 * // ...
 * unsub();
 * ```
 *
 * Источник событий обязан вызывать `dispatchWsEvent(eventType, payload)`
 * для каждого пришедшего сообщения. На сегодня это `app-shell.tsx`.
 */

type WsEventHandler = (payload: unknown) => void;
/**
 * Функция-отправитель сообщений серверу. Регистрируется владельцем WS
 * (`useNotificationsSocket`) на каждом подключении и снимается при close.
 * Возвращает `true`, если сообщение удалось отправить, иначе `false`
 * (тогда мы оставим намерение в очереди для следующего connect).
 */
type WsSender = (data: unknown) => boolean;

/** event_type → множество подписчиков. */
const handlers = new Map<string, Set<WsEventHandler>>();

/**
 * Какие чаты сейчас должен «слушать» этот таб с точки зрения бэкенда.
 * Это NAMESPACED state — он переживает reconnect: при новом подключении
 * мы заново шлём `chat.subscribe` для всех чатов из этого set'а.
 *
 * Источник истины — `chats-page.tsx`, который вызывает `subscribeChat` /
 * `unsubscribeChat` при смене активного чата.
 */
const subscribedChats = new Set<string>();

/** Текущий зарегистрированный отправитель (или `null`, если WS закрыт). */
let sender: WsSender | null = null;

/**
 * Зарегистрировать обработчик события. Возвращает функцию-отписку.
 * Безопасно для SSR (на сервере просто хранит handler — никакого WS).
 */
export function subscribeWsEvent(
  eventType: string,
  handler: WsEventHandler,
): () => void {
  let set = handlers.get(eventType);
  if (!set) {
    set = new Set();
    handlers.set(eventType, set);
  }
  set.add(handler);

  return () => {
    const s = handlers.get(eventType);
    if (!s) return;
    s.delete(handler);
    if (s.size === 0) handlers.delete(eventType);
  };
}

/**
 * Доставить событие подписчикам. Вызывается из единственного источника —
 * `useNotificationsSocket.onEvent` в `app-shell.tsx`. Падение одного
 * слушателя не ломает остальных.
 */
export function dispatchWsEvent(eventType: string, payload: unknown): void {
  const set = handlers.get(eventType);
  if (!set) return;
  set.forEach((h) => {
    try {
      h(payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[ws-client] handler threw", { eventType, err });
    }
  });
}

/**
 * Зарегистрировать функцию-отправитель. Вызывается из `useNotificationsSocket`
 * на `ws.onopen`. Сразу же повторяем все актуальные `chat.subscribe`,
 * чтобы пережить reconnect: бэкенд хранит presence per-socket и теряет
 * подписку при разрыве соединения.
 */
export function setWsSender(next: WsSender | null): void {
  sender = next;
  if (next && subscribedChats.size > 0) {
    // Проигрываем намерение: реальное состояние на сервере = subscribedChats.
    subscribedChats.forEach((chatId) => {
      next({ action: "chat.subscribe", chat_id: chatId });
    });
  }
}

/**
 * Сообщить бэкенду «я сейчас смотрю этот чат» — нужно, чтобы он не
 * создавал persisted notification про новые сообщения в нём (мы и так
 * увидим их в ленте через realtime).
 *
 * Идемпотентно: повторные вызовы с тем же chat_id не создают дубликатов.
 * Если WS ещё не подключён — намерение запомнится и реализуется на onopen.
 */
export function subscribeChat(chatId: string): void {
  if (!chatId) return;
  if (subscribedChats.has(chatId)) return;
  subscribedChats.add(chatId);
  sender?.({ action: "chat.subscribe", chat_id: chatId });
}

/** Снять подписку (закрыли тред / ушли с страницы / переключили чат). */
export function unsubscribeChat(chatId: string): void {
  if (!chatId) return;
  if (!subscribedChats.has(chatId)) return;
  subscribedChats.delete(chatId);
  sender?.({ action: "chat.unsubscribe", chat_id: chatId });
}

/**
 * Полная очистка подписчиков и chat-presence. Вызывается при logout,
 * чтобы свежий пользователь не унаследовал «зомби»-обработчики.
 *
 * (Само WS-соединение не закрывает: им владеет `useNotificationsSocket`
 * в `app-shell`, отключающийся при `enabled=false` после logout.)
 */
export function closeWsClient(): void {
  handlers.clear();
  subscribedChats.clear();
  sender = null;
}
