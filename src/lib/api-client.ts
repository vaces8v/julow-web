/**
 * Low-level API client for Julow Backend.
 * Handles base URL, auth headers, token refresh, and response unwrapping.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

// ── Token storage ──────────────────────────────────────────────

const TOKEN_KEY = "julow_access_token";
const REFRESH_KEY = "julow_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ── Response types ─────────────────────────────────────────────

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

export interface ErrorResponse {
  success: false;
  error:
    | string
    | {
        code?: string;
        message?: string;
      };
  detail?: string;
  message?: string;
}

export class ApiError extends Error {
  status: number;
  code: string;
  detail?: string;

  constructor(status: number, code: string, detail?: string) {
    super(detail ?? code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

// ── Refresh logic ──────────────────────────────────────────────

let refreshPromise: Promise<void> | null = null;

function parseApiError(err: ErrorResponse | null): { code: string; detail?: string } {
  if (!err) return { code: "UNKNOWN" };
  if (typeof err.error === "string") {
    return {
      code: err.error,
      detail: err.detail ?? err.message,
    };
  }
  return {
    code: err.error?.code ?? "UNKNOWN",
    detail: err.detail ?? err.message ?? err.error?.message,
  };
}

async function refreshAccessToken(): Promise<void> {
  const rt = getRefreshToken();
  if (!rt) {
    clearTokens();
    throw new ApiError(401, "NO_REFRESH_TOKEN");
  }

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: rt }),
  });

  if (!res.ok) {
    clearTokens();
    throw new ApiError(401, "REFRESH_FAILED");
  }

  const body: SuccessResponse<{
    access_token: string;
    refresh_token: string;
  }> = await res.json();

  setTokens(body.data.access_token, body.data.refresh_token);
}

// ── Core fetch ─────────────────────────────────────────────────

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  auth?: boolean;
}

async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { body, params, auth = true, ...init } = options;

  // Build URL with query params
  let url = `${API_BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  // Headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (auth) {
    const at = getAccessToken();
    if (at) headers["Authorization"] = `Bearer ${at}`;
  }

  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string>) },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401
  if (res.status === 401 && auth && getRefreshToken()) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    await refreshPromise;

    // Retry with new token
    const newAt = getAccessToken();
    if (newAt) headers["Authorization"] = `Bearer ${newAt}`;

    const retryRes = await fetch(url, {
      ...init,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!retryRes.ok) {
      const err = await retryRes.json().catch(() => null);
      const parsedError = parseApiError(err);
      throw new ApiError(
        retryRes.status,
        parsedError.code,
        parsedError.detail,
      );
    }

    return retryRes.json();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const parsedError = parseApiError(err);
    throw new ApiError(
      res.status,
      parsedError.code,
      parsedError.detail,
    );
  }

  return res.json();
}

// ── Convenience wrappers ───────────────────────────────────────

export async function apiGet<T>(path: string, params?: Record<string, string>) {
  return apiFetch<SuccessResponse<T>>(path, { method: "GET", params });
}

export async function apiGetPaginated<T>(
  path: string,
  params?: Record<string, string>,
) {
  return apiFetch<PaginatedResponse<T>>(path, { method: "GET", params });
}

export async function apiPost<T>(
  path: string,
  body?: Record<string, unknown>,
  options?: Pick<FetchOptions, "auth">,
) {
  return apiFetch<SuccessResponse<T>>(path, {
    method: "POST",
    body,
    ...options,
  });
}

export async function apiPatch<T>(
  path: string,
  body?: Record<string, unknown>,
) {
  return apiFetch<SuccessResponse<T>>(path, {
    method: "PATCH",
    body,
  });
}

export async function apiDelete<T>(path: string) {
  return apiFetch<SuccessResponse<T>>(path, { method: "DELETE" });
}
