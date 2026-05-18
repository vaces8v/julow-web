/**
 * Server-side detection of «мобильный посетитель» по User-Agent.
 *
 * Возвращает `true`, если запрос пришёл с телефона/мини-планшета —
 * используется для рендера MobileOnlyPrompt без флэша десктоп-UI.
 * UA не идеальный сигнал (можно подделать, есть «desktop mode»),
 * поэтому на клиенте дополнительно делаем `matchMedia` resize-check.
 */

import { headers } from "next/headers";

const MOBILE_UA_RE =
  /android|iphone|ipad|ipod|opera mini|opera mobi|windows phone|blackberry|iemobile|kindle|silk|mobile safari/i;

export async function isMobileUserAgent(): Promise<boolean> {
  try {
    const h = await headers();
    const ua = h.get("user-agent") ?? "";
    if (!ua) return false;
    return MOBILE_UA_RE.test(ua);
  } catch {
    // headers() may throw outside request scope (e.g. в build-time prerender);
    // в этом случае дефолтимся в desktop-режим.
    return false;
  }
}
