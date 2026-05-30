import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@/lib/server/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QrCreatedPayload {
  qr_token: string;
  expires_at: string;
  qr_uri: string;
  poll_interval_ms: number;
}

/**
 * POST /api/auth/qr/create
 * Proxies to FastAPI POST /auth/qr/create — starts a QR login challenge for the web client.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const origin =
    req.headers.get("origin") ??
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://julow.ru";
  const webOrigin = origin.startsWith("http") ? origin : `https://${origin}`;

  const upstream = await callBackend<{ success: boolean; data: QrCreatedPayload }>(
    "/auth/qr/create",
    {
      method: "POST",
      body: { web_origin: webOrigin },
      forwardedFor: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    },
  );

  if (!upstream.ok || !upstream.body?.data) {
    return NextResponse.json(
      upstream.body ?? { success: false, error: { code: "QR_CREATE_FAILED", message: "Не удалось создать QR" } },
      { status: upstream.status || 502 },
    );
  }

  return NextResponse.json({ success: true, data: upstream.body.data });
}
