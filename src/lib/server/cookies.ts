import "server-only";
import type { NextResponse } from "next/server";
import type { AuthTokens } from "@/lib/auth/types";

/**
 * Httponly-cookie с токенами авторизации.
 * - `julow_access`  — JWT access-токен (короткоживущий)
 * - `julow_refresh` — JWT refresh-токен (долгоживущий)
 *
 * Браузер их не читает, JS не имеет к ним доступа.
 * Middleware и route handlers читают через `request.cookies.get()`.
 */

export const ACCESS_COOKIE = "julow_access";
export const REFRESH_COOKIE = "julow_refresh";

const COMMON_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  // secure включаем только для https (в проде)
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** Записать пару токенов в ответ. */
export function setAuthCookies(res: NextResponse, tokens: AuthTokens): void {
  res.cookies.set({
    name: ACCESS_COOKIE,
    value: tokens.accessToken,
    ...COMMON_COOKIE_OPTS,
    maxAge: tokens.accessExpiresIn,
  });
  res.cookies.set({
    name: REFRESH_COOKIE,
    value: tokens.refreshToken,
    ...COMMON_COOKIE_OPTS,
    maxAge: tokens.refreshExpiresIn,
  });
}

/** Очистить обе cookie (logout / refresh failure). */
export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set({
    name: ACCESS_COOKIE,
    value: "",
    ...COMMON_COOKIE_OPTS,
    maxAge: 0,
  });
  res.cookies.set({
    name: REFRESH_COOKIE,
    value: "",
    ...COMMON_COOKIE_OPTS,
    maxAge: 0,
  });
}
