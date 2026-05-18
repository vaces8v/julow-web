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
 * POST /api/auth/login
 *
 * Принимает: { email, password, isRememberMe }
 * Проксирует в FastAPI POST /auth/login.
 * Записывает access/refresh в httpOnly cookies. Браузеру отдаёт user (без токенов).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string; isRememberMe?: boolean }
    | null;

  if (!body || !body.email || !body.password) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "email и password обязательны",
        },
      },
      { status: 422 },
    );
  }

  const upstream = await callBackend<{
    success: boolean;
    data: BackendLoginPayload;
  }>("/auth/login", {
    method: "POST",
    body: {
      email: body.email,
      password: body.password,
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
          message: "Не удалось войти",
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
