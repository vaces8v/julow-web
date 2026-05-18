import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/lib/server/cookies";
import { fetchCurrentUser } from "@/lib/server/session";
import type { AuthUser } from "@/lib/auth/types";

/**
 * Best-effort серверная подгрузка текущего пользователя для seed-а кэша
 * React Query на клиенте. Не делает refresh — только проверяет access-токен.
 *
 * Если access протух, вернётся null и клиент сам сходит в /api/auth/me,
 * где есть полная логика refresh + клиринг cookies.
 *
 * Обёрнуто в `cache()` — корневой layout и `(app)/layout.tsx` оба зовут
 * `getServerUser`, и без мемоизации это были бы два сетевых запроса
 * к бэкенду на каждый рендер защищённой страницы.
 */
export const getServerUser = cache(async (): Promise<AuthUser | null> => {
  const c = await cookies();
  const access = c.get(ACCESS_COOKIE)?.value;
  if (!access) return null;
  return await fetchCurrentUser(access);
});
