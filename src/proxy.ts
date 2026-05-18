import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server/cookies";

/**
 * Глобальный proxy (formerly middleware) — Next.js 16:
 * https://nextjs.org/docs/messages/middleware-to-proxy
 *
 * Дешёвая проверка cookies и решение по маршруту ДО выполнения серверных
 * компонентов и отправки клиенту HTML.
 *
 * Правила:
 *   - Публичные маршруты (`/`, `/login`, `/register`, `/login/*`):
 *       если у пользователя есть cookies — редиректим в `/workspace` (dashboard).
 *       иначе — пропускаем как есть.
 *   - Все остальные ("приложение") считаются защищёнными:
 *       если cookies отсутствуют — переписываем (rewrite) на `/_unauthorized`,
 *       где сервер немедленно вызывает `notFound()`.
 *       URL в адресной строке остаётся прежним.
 *
 *   Защита от утечки информации о существовании маршрута: бэкенд тоже валидирует
 *   токены, но даже без сети мы тут отдаём 404 без редиректа на /login.
 *
 *   Дальнейшая «жёсткая» проверка (валидность access-токена) делается
 *   на уровне `/api/proxy/*` (route handler) и серверных layout'ов. Если cookies
 *   стухли — запрос к `/account/me` вернёт 401 → клиент очистит auth-state →
 *   следующая навигация снова попадёт под этот proxy и выдаст 404.
 */

const PUBLIC_EXACT = new Set<string>([
  "/",
  "/login",
  "/register",
  "/invite",
  // Правовые страницы — должны быть доступны и анонимным, и
  // авторизованным пользователям. На них ссылаются футер AuthShell и
  // чекбокс согласия в регистрации, поэтому редирект на /workspace
  // (как для /login) здесь не нужен — пользователь специально пришёл читать.
  "/terms",
  "/privacy",
]);

const PUBLIC_PREFIX = ["/login/", "/invite/"];

// Системные/служебные пути, которые proxy не трогает
const BYPASS_PREFIX = [
  "/api/",
  "/_next/",
  "/_unauthorized",
  "/favicon.ico",
];

const STATIC_FILE_RE = /\.[a-zA-Z0-9]+$/; // *.png, *.svg, *.css и т.п.

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIX.some((p) => pathname.startsWith(p));
}

function isBypassed(pathname: string): boolean {
  if (BYPASS_PREFIX.some((p) => pathname.startsWith(p))) return true;
  // Любой статик-файл с расширением не трогаем
  if (STATIC_FILE_RE.test(pathname)) return true;
  return false;
}

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (isBypassed(pathname)) return NextResponse.next();

  const hasAccess = req.cookies.has(ACCESS_COOKIE);
  const hasRefresh = req.cookies.has(REFRESH_COOKIE);
  const hasSession = hasAccess || hasRefresh;

  if (isPublic(pathname)) {
    // Залогиненного с auth-страницы уводим в приложение
    if (
      hasSession &&
      (pathname === "/login" ||
        pathname === "/register" ||
        pathname.startsWith("/login/"))
    ) {
      const url = req.nextUrl.clone();
      url.pathname = "/workspace";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Защищённый маршрут без сессии → 404 (rewrite, URL не меняется)
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/_unauthorized";
    url.search = "";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Не пускаем proxy на статику и API — экономим CPU.
  matcher: [
    /*
     * Совпадает со всем, кроме:
     *   - /_next/static
     *   - /_next/image
     *   - /favicon.ico
     *   - /api/* (route handlers)
     *   - файлов с расширением (статика)
     */
    "/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
