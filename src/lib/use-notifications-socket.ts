"use client";

import { useEffect, useRef } from "react";
import { api, NotificationWsEvent } from "@/lib/api";
import { setWsSender } from "@/lib/ws-client";

/**
 * React-хук, удерживающий WebSocket-соединение с Notification BC
 * и пробрасывающий `event_type`/`payload` события наверх через колбэк.
 *
 * # Жизненный цикл
 *
 *  1. На монтировании при `enabled=true`:
 *     - тянем `GET /notifications/connection-info` → URL, heartbeat, и т.п.
 *     - тянем JWT через `/api/auth/ws-token` (он живёт только в этой памяти)
 *     - открываем `new WebSocket(url + "?token=" + jwt)`
 *  2. Шлём `"ping"` каждые `heartbeatIntervalSec` секунд (бэкенд отвечает `"pong"`)
 *  3. JSON-сообщения `{event_type, payload}` парсим и зовём `onEvent`
 *  4. При close/error — экспоненциальный backoff (1s → 2s → … → max 30s)
 *  5. На размонтировании или `enabled=false` — корректное закрытие
 *
 * # Почему `onEvent` хранится в ref
 *
 * Колбэк передаётся «свежий» каждый рендер, но нам не хочется по этой причине
 * пересобирать WS-соединение. Сохраняем последний колбэк в `onEventRef.current`
 * и зовём его из обработчиков, которые сами не пересоздаются.
 *
 * # Безопасность токена
 *
 * JWT попадает в JS-память только на момент открытия WS (мы не сохраняем его
 * в state и не логируем). После открытия соединения сам токен в URL уже на
 * стороне браузера в памяти WS-объекта — это компромисс протокола (WebSocket
 * не поддерживает кастомные заголовки авторизации в стандартном API).
 */
export interface UseNotificationsSocketOptions {
  /**
   * Включать ли подключение. Передавайте `false`, пока пользователь
   * не аутентифицирован, иначе backend закроет соединение с кодом 4001
   * (Invalid token), а мы будем зря молотить reconnect-backoff.
   */
  enabled: boolean;

  /**
   * Колбэк на каждое серверное событие. Может быть пересоздан каждый рендер —
   * хук использует ref и не пересоздаёт WS из-за этого.
   */
  onEvent: (event: NotificationWsEvent) => void;
}

export function useNotificationsSocket({
  enabled,
  onEvent,
}: UseNotificationsSocketOptions): void {
  // Храним последний колбэк, чтобы не пересоздавать WS при каждом ререндере.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return; // на всякий случай SSR-guard

    let cancelled = false;
    let ws: WebSocket | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0; // счётчик неудач для backoff

    /** Очистить таймеры и закрытые сокеты. Не закрывает WS принудительно —
     *  это делают onClose / cleanup. */
    const clearTimers = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    /** Планировщик повторного подключения с экспоненциальным backoff,
     *  но не больше 30 секунд. */
    const scheduleReconnect = () => {
      if (cancelled) return;
      attempts++;
      const delay = Math.min(30_000, 1000 * 2 ** (attempts - 1));
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (cancelled) return;
      try {
        const [info, token] = await Promise.all([
          api.getNotificationsConnectionInfo(),
          api.getWsToken(),
        ]);
        if (cancelled) return;

        const sep = info.websocketUrl.includes("?") ? "&" : "?";
        const url = `${info.websocketUrl}${sep}${info.authParam}=${encodeURIComponent(token)}`;

        // Открываем сокет. Любое исключение в конструкторе (например, не та схема)
        // упадёт в catch ниже и инициирует reconnect.
        ws = new WebSocket(url);

        ws.onopen = () => {
          attempts = 0; // успешный коннект — сбрасываем backoff
          const intervalMs = Math.max(5, info.heartbeatIntervalSec) * 1000;
          heartbeatTimer = setInterval(() => {
            try {
              ws?.send("ping");
            } catch {
              /* WS закрылся между тиками — onClose разберётся */
            }
          }, intervalMs);
          // Регистрируем sender в pub/sub-шине: теперь любые
          // `subscribeChat(...)` / `unsubscribeChat(...)` будут уходить
          // через ЭТОТ сокет. На reconnect setWsSender проиграет
          // chat.subscribe для всех актуальных чатов автоматически.
          setWsSender((data) => {
            try {
              ws?.send(JSON.stringify(data));
              return true;
            } catch {
              return false;
            }
          });
        };

        ws.onmessage = (msg) => {
          // Бэкенд отвечает на heartbeat простым текстом "pong" (не JSON).
          if (typeof msg.data === "string" && msg.data === "pong") return;
          if (typeof msg.data !== "string") return; // бинарные сообщения не используются
          try {
            const parsed = JSON.parse(msg.data) as { event_type?: unknown; payload?: unknown };
            if (typeof parsed.event_type !== "string") return;
            onEventRef.current({
              type: parsed.event_type,
              payload: parsed.payload as Record<string, unknown>,
            });
          } catch {
            // Игнорируем не-JSON; защищаемся от поломок бэкенда без падения UI
          }
        };

        ws.onclose = () => {
          clearTimers();
          // Сокет умер — снимаем sender, чтобы `subscribeChat(...)`,
          // вызванные между close и следующим open, не пытались
          // отправить сообщение в мёртвый ws (а отложились до
          // следующего ws.onopen, где они снова проиграются).
          setWsSender(null);
          if (!cancelled) scheduleReconnect();
        };

        ws.onerror = () => {
          // onClose всё равно сработает после onError — оставляем работу ему.
        };
      } catch {
        // Ошибка получения connection-info / токена / открытия сокета.
        // Например, 401, когда сессия истекла. Пробуем снова с backoff;
        // если пользователь де-факто разлогинился, `enabled` станет false и
        // cleanup остановит цикл.
        clearTimers();
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      cancelled = true;
      clearTimers();
      // Хук размонтирован / `enabled=false` — снимаем sender, чтобы
      // `subscribeChat` не писал в умирающий сокет.
      setWsSender(null);
      if (ws) {
        try {
          ws.close();
        } catch {
          /* ignore — браузер сам уберёт ссылку при GC */
        }
      }
    };
  }, [enabled]);
}
