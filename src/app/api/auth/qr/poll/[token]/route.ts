import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@/lib/server/backend";
import { setAuthCookies } from "@/lib/server/cookies";
import { mapBackendSession, type BackendLoginPayload } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QrPollPayload {
  status: "pending" | "confirmed" | "expired";
  access_token?: string;
  refresh_token?: string;
  access_expires_in?: number;
  refresh_expires_in?: number;
  user_id?: string;
  email?: string;
}

/**
 * GET /api/auth/qr/poll/:token
 * Proxies to FastAPI GET /auth/qr/poll/{token}. On confirmed, sets httpOnly cookies.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await ctx.params;
  if (!token) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "token required" } }, { status: 422 });
  }

  const upstream = await callBackend<{ success: boolean; data: QrPollPayload }>(
    `/auth/qr/poll/${encodeURIComponent(token)}`,
    { method: "GET" },
  );

  if (!upstream.ok || !upstream.body?.data) {
    return NextResponse.json(
      upstream.body ?? { success: false, error: { code: "QR_POLL_FAILED", message: "Ошибка опроса QR" } },
      { status: upstream.status || 502 },
    );
  }

  const data = upstream.body.data;
  if (data.status !== "confirmed" || !data.access_token || !data.refresh_token) {
    return NextResponse.json({ success: true, data });
  }

  const loginPayload: BackendLoginPayload = {
    user: {
      id: data.user_id ?? "",
      email: data.email ?? "",
      status: "active",
      role_ids: [],
      is_email_confirmed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    access_expires_in: data.access_expires_in ?? 1800,
    refresh_expires_in: data.refresh_expires_in ?? 604800,
  };

  const session = mapBackendSession(loginPayload);
  const res = NextResponse.json({ success: true, data: { status: "confirmed", user: session.user } });
  setAuthCookies(res, session);
  return res;
}
