import "server-only";

/**
 * Низкоуровневая обёртка для запросов к Julow Backend (FastAPI).
 * Используется только серверным кодом (route handlers, RSC, middleware-helpers).
 *
 * Базовый URL берётся из переменной окружения BACKEND_URL (для серверного proxy)
 * с фолбэком на NEXT_PUBLIC_API_BASE_URL (на случай dev'а без отдельной переменной).
 */

const RAW_BASE =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000/api/v1";

// Срезаем хвостовой /
export const BACKEND_BASE_URL = RAW_BASE.replace(/\/$/, "");

export interface BackendCallOptions extends Omit<RequestInit, "body"> {
  /** Тело запроса. Будет сериализовано в JSON, если это объект. */
  body?: unknown;
  /** Bearer access-токен. */
  accessToken?: string | null;
  /** IP клиента (для проброса в backend для аудита). */
  forwardedFor?: string | null;
  /** User-Agent клиента. */
  userAgent?: string | null;
  /** Таймаут (мс). По умолчанию 15000. */
  timeoutMs?: number;
}

export interface BackendResult<T = unknown> {
  ok: boolean;
  status: number;
  body: T | null;
}

/** Выполнить запрос к бэкенду. Никогда не бросает на HTTP-ошибки — возвращает status+body. */
export async function callBackend<T = unknown>(
  path: string,
  opts: BackendCallOptions = {},
): Promise<BackendResult<T>> {
  const url = `${BACKEND_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 15000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(opts.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (opts.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (opts.accessToken) {
    headers.set("Authorization", `Bearer ${opts.accessToken}`);
  }
  if (opts.forwardedFor) headers.set("X-Forwarded-For", opts.forwardedFor);
  if (opts.userAgent) headers.set("User-Agent", opts.userAgent);

  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    body =
      typeof opts.body === "string"
        ? opts.body
        : opts.body instanceof FormData ||
            opts.body instanceof URLSearchParams ||
            opts.body instanceof Blob
          ? (opts.body as BodyInit)
          : JSON.stringify(opts.body);
  }

  try {
    const res = await fetch(url, {
      ...opts,
      method: opts.method ?? (body !== undefined ? "POST" : "GET"),
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    let parsed: T | null = null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      parsed = (await res.json().catch(() => null)) as T | null;
    } else {
      // не-JSON ответ — оставляем null
      await res.text().catch(() => "");
    }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (err) {
    // network / timeout / aborted
    return {
      ok: false,
      status: 0,
      body: {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message:
            err instanceof Error ? err.message : "Backend network error",
        },
      } as unknown as T,
    };
  } finally {
    clearTimeout(t);
  }
}
