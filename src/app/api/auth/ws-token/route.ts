import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/server/cookies";
import { refreshTokens } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/ws-token
 *
 * Возвращает короткоживущий access-токен в JSON для подключения к WebSocket.
 *
 * Бэкенд `/ws/notifications?token=<jwt>` ждёт JWT в query, а наш фронт хранит
 * токены в httpOnly-cookies. Это единственный путь "достать" токен на клиент,
 * не нарушая принципа "никаких токенов в JS-доступной памяти" — клиент
 * получает его только сразу перед открытием WS и больше нигде не использует.
 *
 * Поведение:
 *   - Если есть access-cookie — отдаём его.
 *   - Если только refresh — пытаемся обновить, отдаём свежий access и
 *     обновляем cookies.
 *   - Иначе — 401 + чистим cookies.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const access = req.cookies.get(ACCESS_COOKIE)?.value ?? "";
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value ?? "";

  if (access) {
    return NextResponse.json({ success: true, data: { token: access } });
  }

  if (refresh) {
    const tokens = await refreshTokens(refresh);
    if (tokens) {
      const res = NextResponse.json({ success: true, data: { token: tokens.accessToken } });
      setAuthCookies(res, tokens);
      return res;
    }
  }

  const res = NextResponse.json(
    {
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Не аутентифицирован" },
    },
    { status: 401 },
  );
  clearAuthCookies(res);
  return res;
}
