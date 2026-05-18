import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/server/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 *
 * На бэкенде нет /auth/logout — это чисто клиентское действие.
 * Просто стираем cookies. Сессия в БД останется до истечения TTL refresh-токена,
 * но пользоваться ей будет нельзя без cookie.
 */
export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ success: true, data: { message: "ok" } });
  clearAuthCookies(res);
  return res;
}
