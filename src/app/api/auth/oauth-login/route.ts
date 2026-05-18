import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@/lib/server/backend";
import { setAuthCookies } from "@/lib/server/cookies";
import {
  mapBackendSession,
  type BackendLoginPayload,
} from "@/lib/auth/types";
import type { BackendErrorBody } from "@/lib/auth/error-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/oauth-login
 *
 * Завершает OAuth-flow: после того как провайдер (Google/GitHub) вернул
 * пользователя на `/oauth/callback?code=...&provider=...`, callback-страница
 * POST'ит сюда тело `{ provider, code, redirectUri, isRememberMe }`.
 *
 *   1. Прокидываем в FastAPI POST /auth/login/oauth с тем же `redirect_uri`,
 *      что был использован для получения кода — backend проверит совпадение
 *      и обменяет code → token у провайдера.
 *   2. Backend в случае успеха возвращает { user, access_token, refresh_token }.
 *   3. Кладём токены в httpOnly cookies (тот же путь, что и обычный login),
 *      браузеру отдаём только { user }.
 *
 * Provider-имя приходит как "google" или "github" — backend ожидает
 * полные коды `oauth_google`/`oauth_github`, поэтому добавляем префикс.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as
    | {
        provider?: string;
        code?: string;
        redirectUri?: string;
        isRememberMe?: boolean;
      }
    | null;

  if (!body || !body.provider || !body.code || !body.redirectUri) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "provider, code и redirectUri обязательны",
        },
      },
      { status: 422 },
    );
  }

  // Backend кодирует провайдеры как "oauth_google" / "oauth_github".
  // Нормализуем — префикс уже мог быть передан, не дублируем его.
  const providerCode = body.provider.startsWith("oauth_")
    ? body.provider
    : `oauth_${body.provider}`;

  const upstream = await callBackend<{
    success: boolean;
    data: BackendLoginPayload;
  }>("/auth/login/oauth", {
    method: "POST",
    body: {
      provider: providerCode,
      authorization_code: body.code,
      redirect_uri: body.redirectUri,
      is_remember_me: !!body.isRememberMe,
    },
    forwardedFor: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  if (!upstream.ok || !upstream.body || !("data" in upstream.body)) {
    const errBody = upstream.body as unknown as BackendErrorBody | null;
    return NextResponse.json(
      errBody ?? {
        success: false,
        error: {
          code: upstream.status === 0 ? "NETWORK_ERROR" : "UNKNOWN",
          message: "OAuth login failed",
        },
      },
      { status: upstream.status || 502 },
    );
  }

  const session = mapBackendSession(upstream.body.data);
  const res = NextResponse.json({ success: true, data: { user: session.user } });
  setAuthCookies(res, session);
  return res;
}
