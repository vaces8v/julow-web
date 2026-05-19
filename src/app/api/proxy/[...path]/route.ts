import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/server/cookies";
import { BACKEND_BASE_URL } from "@/lib/server/backend";
import { refreshTokens } from "@/lib/server/session";

/**
 * Универсальный прокси для аутентифицированных запросов к Julow Backend.
 *
 * Запросы вида `/api/proxy/<path>?<qs>` пробрасываются в `<BACKEND>/<path>?<qs>`
 * с автоматической подстановкой Bearer-токена из httpOnly-cookie.
 *
 * Ключевое поведение:
 *   - На 401 от бэкенда автоматически пытается обновить пару токенов через /auth/refresh
 *     и повторяет исходный запрос **один раз**.
 *   - При неудачном refresh — стирает обе cookies и отдаёт клиенту 401.
 *   - Тело и заголовки исходного запроса транслируются как есть, кроме `cookie`/`host`/
 *     `authorization` (последний выставляется нами).
 *
 * Этим достигается то, что фронтенд никогда не работает с токенами напрямую,
 * и при истечении access-токена пользователь не выкидывается (silent refresh).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "cookie",
  "authorization",
  "content-length",
]);

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

async function readBody(req: NextRequest): Promise<Uint8Array | null> {
  if (req.method === "GET" || req.method === "HEAD") return null;
  const buf = await req.arrayBuffer();
  return buf.byteLength === 0 ? null : new Uint8Array(buf);
}

function buildHeaders(req: NextRequest, accessToken: string | null): Headers {
  const out = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out.set(key, value);
  });
  if (accessToken) out.set("Authorization", `Bearer ${accessToken}`);
  if (!out.has("Accept")) out.set("Accept", "application/json");
  return out;
}

async function forwardOnce(
  upstreamUrl: string,
  method: string,
  headers: Headers,
  body: Uint8Array | null,
): Promise<Response> {
  const res = await fetch(upstreamUrl, {
    method,
    headers,
    body: body as BodyInit | null,
    cache: "no-store",
    // `manual` — обрабатываем редиректы сами, чтобы не терять body
    // (ArrayBuffer detach при redirect:follow для POST/PUT/PATCH).
    redirect: "manual",
  });

  // Следуем за 3xx редиректами вручную, пересоздавая body.
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (location) {
      const redirectUrl = location.startsWith("http")
        ? location
        : new URL(location, upstreamUrl).toString();
      return fetch(redirectUrl, {
        method,
        headers,
        body: body as BodyInit | null,
        cache: "no-store",
        redirect: "manual",
      });
    }
  }

  return res;
}

async function passthrough(
  upstream: Response,
  upstreamUrl?: string,
  method?: string,
): Promise<NextResponse> {
  // Создаём NextResponse, копируем тело и (некоторые) заголовки.
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== "set-cookie") {
      responseHeaders.set(key, value);
    }
  });
  const buf = await upstream.arrayBuffer();
  // Серверный лог для не-2xx ответов: без него клиент видит просто "500" и
  // у нас нет ни кода ошибки, ни сообщения от бэкенда. Печатаем в stdout
  // только в dev, чтобы не утекало в проде.
  if (
    process.env.NODE_ENV !== "production" &&
    upstream.status >= 400 &&
    upstreamUrl
  ) {
    try {
      const text = new TextDecoder().decode(buf);
      const truncated = text.length > 2000 ? `${text.slice(0, 2000)}…(truncated)` : text;
      console.warn(
        `[proxy] ${method ?? "?"} ${upstreamUrl} → ${upstream.status}\n${truncated}`,
      );
    } catch {
      /* binary body or decoder error — ignore */
    }
  }
  return new NextResponse(buf, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

async function handle(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const { path } = await ctx.params;
  const segments = path.map((s) => encodeURIComponent(s)).join("/");
  // Backend-роуты зарегистрированы без trailing slash.
  // При redirect (307) Node.js fetch с redirect:follow пытается
  // переиспользовать ArrayBuffer тела, но оно detached → crash.
  // Решение: не добавляем trailing slash и используем redirect:manual.
  const search = req.nextUrl.search;
  const upstreamUrl = `${BACKEND_BASE_URL}/${segments}${search}`;

  const access = req.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value ?? null;

  // Если клиент вообще не авторизован — сразу 401, не дёргаем бэкенд.
  if (!access && !refresh) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "UNAUTHENTICATED", message: "Не аутентифицирован" },
      },
      { status: 401 },
    );
  }

  const body = await readBody(req);
  let headers = buildHeaders(req, access);
  let upstream = await forwardOnce(upstreamUrl, req.method, headers, body);

  // Прозрачный refresh при 401
  if (upstream.status === 401 && refresh) {
    const newTokens = await refreshTokens(refresh);
    if (!newTokens) {
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
    headers = buildHeaders(req, newTokens.accessToken);
    upstream = await forwardOnce(upstreamUrl, req.method, headers, body);
    const res = await passthrough(upstream, upstreamUrl, req.method);
    setAuthCookies(res, newTokens);
    return res;
  }

  return passthrough(upstream, upstreamUrl, req.method);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
