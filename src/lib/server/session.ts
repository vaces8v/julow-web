import "server-only";
import { callBackend } from "@/lib/server/backend";
import {
  mapBackendUser,
  type AuthTokens,
  type AuthUser,
  type BackendLoginPayload,
  type BackendUserResponse,
} from "@/lib/auth/types";

/**
 * Высокоуровневые серверные хелперы для сессии.
 * Используются внутри route handlers и серверных компонентов.
 */

/**
 * Обновляет пару токенов через POST /auth/refresh.
 * Возвращает новые токены или null, если refresh-токен невалиден.
 */
export async function refreshTokens(
  refreshToken: string,
): Promise<AuthTokens | null> {
  if (!refreshToken) return null;
  const r = await callBackend<{
    success: boolean;
    data: BackendLoginPayload;
  }>("/auth/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
  if (!r.ok || !r.body || !("data" in r.body)) return null;
  const d = r.body.data;
  return {
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    accessExpiresIn: d.access_expires_in,
    refreshExpiresIn: d.refresh_expires_in,
  };
}

/** Получить текущего пользователя по access-токену. null при 401/любой ошибке. */
export async function fetchCurrentUser(
  accessToken: string,
): Promise<AuthUser | null> {
  if (!accessToken) return null;
  const r = await callBackend<{
    success: boolean;
    data: BackendUserResponse;
  }>("/account/me", {
    method: "GET",
    accessToken,
  });
  if (!r.ok || !r.body || !("data" in r.body)) return null;
  return mapBackendUser(r.body.data);
}
