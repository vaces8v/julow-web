import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@/lib/server/backend";
import {
  mapBackendUser,
  type BackendUserResponse,
} from "@/lib/auth/types";
import type { BackendErrorBody } from "@/lib/auth/error-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register
 *
 * Принимает: { email, password }
 * Проксирует в FastAPI POST /auth/register.
 * После регистрации пользователь не залогинен автоматически — нужно вызвать /api/auth/login.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string }
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
    data: BackendUserResponse;
  }>("/auth/register", {
    method: "POST",
    body: { email: body.email, password: body.password },
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
          message: "Не удалось зарегистрироваться",
        },
      },
      { status: upstream.status || 502 },
    );
  }

  const user = mapBackendUser(upstream.body.data);
  return NextResponse.json(
    { success: true, data: { user } },
    { status: upstream.status === 201 ? 201 : 200 },
  );
}
