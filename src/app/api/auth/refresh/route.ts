import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "@/lib/server/cookies";
import { refreshTokens } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/refresh
 *
 * Читает refresh-cookie, обращается к FastAPI /auth/refresh,
 * перезаписывает обе cookies. Тело refresh-токена клиенту не отдаём.
 *
 * Используется редко — основной refresh идёт прозрачно внутри /api/proxy/*.
 * Но публично доступно для случаев, когда клиент хочет «продлить» сессию вручную.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    const res = NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_REFRESH_TOKEN", message: "Нет refresh-токена" },
      },
      { status: 401 },
    );
    clearAuthCookies(res);
    return res;
  }

  const tokens = await refreshTokens(refresh);
  if (!tokens) {
    const res = NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_REFRESH_TOKEN",
          message: "Сессия истекла, войдите заново",
        },
      },
      { status: 401 },
    );
    clearAuthCookies(res);
    return res;
  }

  const res = NextResponse.json({ success: true, data: { refreshed: true } });
  setAuthCookies(res, tokens);
  // Чтоб клиент мог при желании сразу использовать access (он всё равно не виден JS)
  void req.cookies.get(ACCESS_COOKIE);
  return res;
}
