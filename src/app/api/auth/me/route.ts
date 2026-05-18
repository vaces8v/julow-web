import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/server/cookies";
import { fetchCurrentUser, refreshTokens } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 *
 * Возвращает текущего пользователя.
 *  - Сначала пробует с access-токеном
 *  - На 401 пытается обновить через refresh
 *  - На полный фейл — 401 + очищенные cookies
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const access = req.cookies.get(ACCESS_COOKIE)?.value ?? "";
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value ?? "";

  if (!access && !refresh) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHENTICATED", message: "Не аутентифицирован" } },
      { status: 401 },
    );
  }

  // Попытка #1: с текущим access
  if (access) {
    const user = await fetchCurrentUser(access);
    if (user) {
      return NextResponse.json({ success: true, data: { user } });
    }
  }

  // Попытка #2: refresh + retry
  if (refresh) {
    const tokens = await refreshTokens(refresh);
    if (tokens) {
      const user = await fetchCurrentUser(tokens.accessToken);
      if (user) {
        const res = NextResponse.json({ success: true, data: { user } });
        setAuthCookies(res, tokens);
        return res;
      }
    }
  }

  // Полный фейл — чистим cookies, возвращаем 401
  const res = NextResponse.json(
    {
      success: false,
      error: { code: "INVALID_REFRESH_TOKEN", message: "Сессия истекла" },
    },
    { status: 401 },
  );
  clearAuthCookies(res);
  return res;
}
