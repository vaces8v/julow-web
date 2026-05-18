/**
 * Julow Web — клиентский HTTP-клиент.
 *
 * Архитектура:
 *   Browser  →  /api/proxy/<path>   (Next BFF, добавляет Bearer-токен из httpOnly cookie)
 *            →  /api/v1/<path>      (FastAPI)
 *
 * Клиент НЕ работает с токенами напрямую. Всё, что есть на клиенте — cookie
 * `julow_access` и `julow_refresh`, которые недоступны JS (httpOnly).
 *
 * Авто-refresh на 401 происходит на уровне `/api/proxy/[...path]/route.ts`.
 * Если refresh не удался, прокси возвращает 401 + очищает cookies, а клиент
 * получает уведомление через `subscribeAuthFailure()`.
 */

import { parseBackendError } from "@/lib/auth/error-codes";

const PROXY_BASE = "/api/proxy";

// ── Response типы ─────────────────────────────────────────────

export interface SuccessResponse<T> {
  success: boolean;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ── Кастомная ошибка ──────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  code: string;
  detail?: string;
  fieldErrors: Record<string, string>;

  constructor(
    status: number,
    code: string,
    detail?: string,
    fieldErrors: Record<string, string> = {},
  ) {
    super(detail ?? code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
  }
}

// ── Подписка на авторизационные сбои ──────────────────────────

type AuthFailureListener = (err: ApiError) => void;
const authFailureListeners = new Set<AuthFailureListener>();

/**
 * Подписаться на 401 после неудачного refresh.
 * AuthProvider использует это, чтобы сбросить in-memory user state и показать тост.
 */
export function subscribeAuthFailure(fn: AuthFailureListener): () => void {
  authFailureListeners.add(fn);
  return () => {
    authFailureListeners.delete(fn);
  };
}

function emitAuthFailure(err: ApiError): void {
  authFailureListeners.forEach((fn) => {
    try {
      fn(err);
    } catch {
      // не даём одному падающему листенеру сломать остальные
    }
  });
}

// ── Низкоуровневый fetch ──────────────────────────────────────

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: Record<string, unknown> | unknown[] | null;
  params?: Record<string, string | number | boolean | undefined | null>;
}

function buildQuery(params?: FetchOptions["params"]): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, params, headers: optHeaders, ...init } = options;
  const url = `${PROXY_BASE}${path.startsWith("/") ? path : `/${path}`}${buildQuery(params)}`;

  const headers = new Headers(optHeaders);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (body !== undefined && body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...init,
    headers,
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    credentials: "same-origin", // cookies on same origin
    cache: "no-store",
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    const parsed = parseBackendError(errBody);
    const err = new ApiError(res.status, parsed.code, parsed.message, parsed.fieldErrors);
    if (res.status === 401) {
      emitAuthFailure(err);
    }
    throw err;
  }

  // Некоторые ответы могут быть пустыми (204). На таких возвращаем undefined as T
  if (res.status === 204) return undefined as unknown as T;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return undefined as unknown as T;
  return (await res.json()) as T;
}

// ── Удобные обёртки ───────────────────────────────────────────

export async function apiGet<T>(
  path: string,
  params?: FetchOptions["params"],
): Promise<SuccessResponse<T>> {
  return apiFetch<SuccessResponse<T>>(path, { method: "GET", params });
}

export async function apiGetPaginated<T>(
  path: string,
  params?: FetchOptions["params"],
): Promise<PaginatedResponse<T>> {
  return apiFetch<PaginatedResponse<T>>(path, { method: "GET", params });
}

export async function apiPost<T>(
  path: string,
  body?: Record<string, unknown> | unknown[] | null,
): Promise<SuccessResponse<T>> {
  return apiFetch<SuccessResponse<T>>(path, { method: "POST", body });
}

export async function apiPatch<T>(
  path: string,
  body?: Record<string, unknown> | unknown[] | null,
): Promise<SuccessResponse<T>> {
  return apiFetch<SuccessResponse<T>>(path, { method: "PATCH", body });
}

export async function apiPut<T>(
  path: string,
  body?: Record<string, unknown> | unknown[] | null,
): Promise<SuccessResponse<T>> {
  return apiFetch<SuccessResponse<T>>(path, { method: "PUT", body });
}

export async function apiDelete<T = void>(path: string): Promise<SuccessResponse<T>> {
  return apiFetch<SuccessResponse<T>>(path, { method: "DELETE" });
}

/**
 * POST с `multipart/form-data` (загрузка файлов).
 * НЕ выставляем `Content-Type` — браузер сам подставит boundary.
 * Идёт через тот же `/api/proxy`, поэтому accessToken добавляется автоматически.
 */
export async function apiPostMultipart<T>(
  path: string,
  form: FormData,
): Promise<SuccessResponse<T>> {
  const url = `${PROXY_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: form,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    const parsed = parseBackendError(errBody);
    const err = new ApiError(res.status, parsed.code, parsed.message, parsed.fieldErrors);
    if (res.status === 401) emitAuthFailure(err);
    throw err;
  }
  if (res.status === 204) return { success: true, data: undefined as unknown as T };
  return (await res.json()) as SuccessResponse<T>;
}

// ── Auth-эндпоинты на уровне Next BFF ─────────────────────────

/**
 * Эти 4 функции — единственный способ для клиента говорить с auth-flow.
 * Все они вызывают Next route handlers `/api/auth/*`, которые работают с cookies.
 */
export async function authLogin(payload: {
  email: string;
  password: string;
  isRememberMe?: boolean;
}): Promise<{ user: import("@/lib/auth/types").AuthUser }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const parsed = parseBackendError(body);
    throw new ApiError(res.status, parsed.code, parsed.message, parsed.fieldErrors);
  }
  const json = (await res.json()) as { success: true; data: { user: import("@/lib/auth/types").AuthUser } };
  return json.data;
}

export async function authRegister(payload: {
  email: string;
  password: string;
}): Promise<{ user: import("@/lib/auth/types").AuthUser }> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const parsed = parseBackendError(body);
    throw new ApiError(res.status, parsed.code, parsed.message, parsed.fieldErrors);
  }
  const json = (await res.json()) as { success: true; data: { user: import("@/lib/auth/types").AuthUser } };
  return json.data;
}

export async function authLogout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  });
}

export async function authMe(): Promise<import("@/lib/auth/types").AuthUser | null> {
  const res = await fetch("/api/auth/me", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const parsed = parseBackendError(body);
    throw new ApiError(res.status, parsed.code, parsed.message, parsed.fieldErrors);
  }
  const json = (await res.json()) as {
    success: true;
    data: { user: import("@/lib/auth/types").AuthUser };
  };
  return json.data.user;
}
