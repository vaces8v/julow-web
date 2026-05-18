"use client";

/**
 * DashboardsPage — самостоятельная страница `/dashboards`.
 *
 * Тонкая обёртка над `DashboardsView`: подтягивает активный workspace
 * через `useWorkspaceShell`, обрабатывает empty-state «нет воркспейса»
 * и отрисовывает заголовок страницы.
 */

import { useEffect, useState } from "react";
import { Text } from "@heroui/react";
import { useI18n } from "@/i18n/context";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import { DashboardsView } from "@/components/pages/dashboards-view";

export function DashboardsPage() {
  const { t } = useI18n();
  const dt = t.dashboards;
  const { activeWorkspaceId } = useWorkspaceShell();
  /**
   * `mounted` — guard от SSR/CSR hydration mismatch.
   *
   * `useWorkspaceShell` подтягивает активный workspace из cookies/
   * localStorage, которые доступны только на клиенте. При SSR
   * `activeWorkspaceId` всегда `null`, и `DashboardsView` рендерит
   * empty-state Card; после маунта appears реальный workspace, и
   * рендерится grid с виджетами — React падает с hydration mismatch
   * (`<div className="grid …"> vs <div className="card card--default">`).
   *
   * Откладываем рендер `DashboardsView` до клиентского маунта: и
   * сервер, и initial-client render возвращают одинаковую разметку
   * (заголовок + null), а после `useEffect` клиент дорисует панель.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold">{dt.pageTitle}</h1>
          <Text color="muted" className="m-0 text-sm">
            {dt.pageSubtitle}
          </Text>
        </div>
      </header>

      {mounted ? <DashboardsView workspaceId={activeWorkspaceId ?? null} /> : null}
    </div>
  );
}
