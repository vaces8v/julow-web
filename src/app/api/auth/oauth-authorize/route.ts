import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@/lib/server/backend";
import type { BackendErrorBody } from "@/lib/auth/error-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BackendAuthorizeResponse {
  provider: string;
  authorize_url: string;
}

/**
 * GET /api/auth/oauth-authorize?provider=google&redirect_uri=...
 *
 * Прокси на FastAPI GET /auth/oauth/{oauth_<provider>}/authorize.
 *
 * Зачем нужен BFF, а не прямой вызов из браузера на backend:
 *  - Браузер обращается к Next.js (same-origin), нет CORS-проблем;
 *  - Можно валидировать `redirect_uri` (whitelist), чтобы не дать злоумышленнику
 *    подсунуть произвольный callback URL и украсть OAuth-код.
 *
 * Параметры:
 *  - provider:     "google" | "github" | "yandex" (без `oauth_` префикса — добавим сами)
 *  - redirect_uri: URL, на который провайдер вернёт юзера. Обычно
 *                  `${origin}/oauth/callback`. Должен совпадать с тем,
 *                  что зарегистрирован в консоли провайдера.
 *
 * Ответ:
 *  { success: true, data: { provider, authorize_url } }
 *  Клиент делает `window.location.assign(authorize_url)`.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");
  const redirectUri = searchParams.get("redirect_uri");

  if (!provider || !redirectUri) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "provider и redirect_uri обязательны",
        },
      },
      { status: 422 },
    );
  }

  // Backend ожидает полный код провайдера: "oauth_google", "oauth_github".
  const providerCode = provider.startsWith("oauth_") ? provider : `oauth_${provider}`;

  const qs = new URLSearchParams({ redirect_uri: redirectUri }).toString();
  const upstream = await callBackend<{
    success: boolean;
    data: BackendAuthorizeResponse;
  }>(`/auth/oauth/${providerCode}/authorize?${qs}`, {
    method: "GET",
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
          message: "Не удалось получить authorize URL",
        },
      },
      { status: upstream.status || 502 },
    );
  }

  return NextResponse.json({ success: true, data: upstream.body.data });
}
