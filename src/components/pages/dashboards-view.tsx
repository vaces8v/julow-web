"use client";

/**
 * DashboardsView — UI для бэкенд-аналитики (`/dashboards`, `/analytics/execute`).
 *
 * В отличие от соседних вкладок analytics-page (которые рассчитывают
 * метрики из `/tasks/mine`), здесь рендерятся реальные дашборды,
 * сохранённые в БД, с виджетами, выполняющимися через
 * `executeAnalyticsQuery`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Chip, Input, Text, TextArea } from "@heroui/react";
import {
  Add01Icon,
  Analytics01Icon,
  Cancel01Icon,
  Delete02Icon,
  Edit02Icon,
  Loading03Icon,
  RefreshIcon,
  Tag01Icon,
} from "hugeicons-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip as RechartsTip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { useI18n, type Locale } from "@/i18n/context";
import { RechartsAuto } from "@/components/ui/recharts-auto";
import { WidgetEditorDialog } from "@/components/pages/widget-editor-dialog";
import {
  humanColumnLabel,
  useLabelResolver,
  useResolvedResult,
} from "@/components/pages/dashboard-label-resolver";
import {
  api,
  type AnalyticsResult,
  type AnalyticsWidget,
  type DashboardPayload,
  type DashboardTemplatePayload,
} from "@/lib/api";

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f97316", "#22c55e", "#ec4899"];

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

interface DashboardsViewProps {
  workspaceId: string | null;
}

type LoadState = "idle" | "loading" | "ready" | "error";

export function DashboardsView({ workspaceId }: DashboardsViewProps) {
  const { t } = useI18n();
  const ins = t.insights;
  const dt = t.dashboards;

  const [dashboards, setDashboards] = useState<DashboardPayload[]>([]);
  const [templates, setTemplates] = useState<DashboardTemplatePayload[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDash, setActiveDash] = useState<DashboardPayload | null>(null);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [creating, setCreating] = useState(false);
  // Открыто ли модальное окно «Создать дашборд» (заменяет window.prompt).
  const [createOpen, setCreateOpen] = useState(false);

  // ── Загрузка списка дашбордов ───────────────────────────────
  const reloadList = useCallback(async () => {
    if (!workspaceId) {
      setDashboards([]);
      setListState("ready");
      return;
    }
    setListState("loading");
    try {
      const list = await api.listDashboards(workspaceId);
      setDashboards(list);
      setListState("ready");
      setErrorMsg(null);
      // Авто-выбираем default-дашборд (или первый из списка), если
      // ничего ещё не выбрано — он же является «базовым обзором».
      setActiveId((prev) => {
        if (prev) return prev;
        const def = list.find((d) => d.isDefault);
        return def?.id ?? list[0]?.id ?? null;
      });
    } catch (err) {
      setListState("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }, [workspaceId]);

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

  // Шаблоны лениво — только когда пользователь открывает CTA.
  const reloadTemplates = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const list = await api.listDashboardTemplates(workspaceId);
      setTemplates(list);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }, [workspaceId]);

  useEffect(() => {
    if (showTemplates) void reloadTemplates();
  }, [showTemplates, reloadTemplates]);

  // ── Загрузка деталей выбранного дашборда ────────────────────
  // `reloadVersion` дёргается из CRUD-операций над виджетами, чтобы
  // повторно подтянуть дашборд без сброса выбранного id.
  const [reloadVersion, setReloadVersion] = useState(0);
  const reloadActiveDashboard = useCallback(
    () => setReloadVersion((v) => v + 1),
    [],
  );

  useEffect(() => {
    if (!activeId) {
      setActiveDash(null);
      setDetailState("idle");
      return;
    }
    let cancelled = false;
    setDetailState("loading");
    api
      .getDashboard(activeId)
      .then((d) => {
        if (cancelled) return;
        setActiveDash(d);
        setDetailState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDetailState("error");
        setErrorMsg(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, reloadVersion]);

  // ── Создание дашборда из шаблона ─────────────────────────────
  const handleCreateFromTemplate = useCallback(
    async (template: DashboardTemplatePayload) => {
      if (!workspaceId) return;
      setCreating(true);
      try {
        const created = await api.createDashboardFromTemplate({
          workspaceId,
          templateId: template.id,
        });
        setShowTemplates(false);
        setActiveId(created.id);
        await reloadList();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setCreating(false);
      }
    },
    [workspaceId, reloadList],
  );

  // ── Создание пустого дашборда ────────────────────────────────
  // Открывает модалку (раньше было `window.prompt`, что выглядит
  // системно и нерасширяемо).
  const handleCreateBlank = useCallback(() => {
    if (!workspaceId) return;
    setCreateOpen(true);
  }, [workspaceId]);

  // Submit'ит форму из CreateDashboardDialog. Принимает уже
  // отвалидированные значения (имя — обязательное).
  const handleSubmitCreate = useCallback(
    async (payload: { name: string; description?: string }) => {
      if (!workspaceId) return;
      setCreating(true);
      try {
        const created = await api.createDashboard({
          workspaceId,
          name: payload.name,
          description: payload.description,
        });
        setActiveId(created.id);
        setCreateOpen(false);
        await reloadList();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setCreating(false);
      }
    },
    [workspaceId, reloadList],
  );

  // ── Авто-создание базового дашборда ──────────────────────────
  // Если у workspace ещё нет дашборда с `is_default=true`, мы
  // автоматически создаём «Обзор воркспейса» из встроенного
  // системного шаблона `Project Overview` и помечаем его как
  // default. Это работает в двух случаях:
  //   1) Список дашбордов вообще пустой (новый workspace).
  //   2) В списке уже есть user-created дашборды, но ни один из
  //      них не default — например, для старых workspace, в
  //      которых юзер заводил свои dashboards до этой фичи.
  // Триггерится один раз благодаря `ensuringDefaultRef` +
  // backend-индексу `is_default` (повторных копий не создаст).
  const ensuringDefaultRef = useRef(false);
  const hasDefault = useMemo(() => dashboards.some((d) => d.isDefault), [dashboards]);
  useEffect(() => {
    if (!workspaceId) return;
    if (listState !== "ready") return;
    if (hasDefault) return;
    if (ensuringDefaultRef.current) return;

    ensuringDefaultRef.current = true;
    void (async () => {
      try {
        const tpls = await api.listDashboardTemplates(workspaceId);
        const overview =
          tpls.find((tpl) => tpl.isSystem && tpl.name === "Project Overview") ??
          tpls.find((tpl) => tpl.isSystem) ??
          tpls[0];
        if (!overview) return; // нет ни одного шаблона — пропускаем
        const created = await api.createDashboardFromTemplate({
          workspaceId,
          templateId: overview.id,
          name: dt.workspaceOverviewName,
          description: dt.workspaceOverviewDescription,
        });
        try {
          await api.setDefaultDashboard(created.id);
        } catch {
          /* не критично — у дашборда останется is_default=false */
        }
        setActiveId(created.id);
        await reloadList();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        ensuringDefaultRef.current = false;
      }
    })();
  }, [
    workspaceId,
    listState,
    hasDefault,
    reloadList,
    dt.workspaceOverviewName,
    dt.workspaceOverviewDescription,
  ]);

  if (!workspaceId) {
    return (
      <Card>
        <Card.Content className="p-6 text-center">
          <Text color="muted">{dt.noWorkspace}</Text>
        </Card.Content>
      </Card>
    );
  }

  return (
    <>
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* ── Левая колонка: список дашбордов ─────────────────────── */}
      <Card className="min-w-0 self-start lg:sticky lg:top-4">
        <Card.Header>
          <div className="flex items-center justify-between gap-2">
            <Card.Title>{dt.listTitle}</Card.Title>
            <button
              type="button"
              onClick={reloadList}
              className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              aria-label={dt.refresh}
              title={dt.refresh}
            >
              <RefreshIcon size={16} strokeWidth={1.8} />
            </button>
          </div>
        </Card.Header>
        <Card.Content className="px-2 pb-3 pt-0">
          {listState === "loading" && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--muted)]">
              <Loading03Icon size={14} className="animate-spin" />
              <span>{dt.loading}</span>
            </div>
          )}
          {listState === "ready" && dashboards.length === 0 && (
            <div className="space-y-2 px-3 py-2">
              <Text color="muted" className="m-0 text-sm">
                {dt.empty}
              </Text>
            </div>
          )}
          {dashboards.length > 0 && (
            <ul className="m-0 list-none space-y-0.5 p-0">
              {/* Default-дашборд должен быть «самым верхним уровнем».
                *   Сортируем on-the-fly: сначала default, потом по дате
                *   обновления (свежие выше). */}
              {[...dashboards]
                .sort((a, b) => {
                  if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
                  return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
                })
                .map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(d.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      activeId === d.id
                        ? "bg-accent/10 text-[var(--foreground)]"
                        : "text-[var(--muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                    {d.isDefault && (
                      // `Chip` — inline-ярлык. Раньше использовался
                      // `Badge`, но в HeroUI это notification-dot с дефолтным
                      // `placement="top-right"`: `position: absolute; transform:
                      // translate(25%, -25%)` — из-за этого лейбл
                      // «По умолчанию» выезжал за верхний-правый угол
                      // карточки списка.
                      <Chip size="sm" color="accent" variant="soft" className="shrink-0">
                        {dt.default}
                      </Chip>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-col gap-1.5 px-2">
            <Button
              size="sm"
              variant="outline"
              onPress={() => setShowTemplates((s) => !s)}
              isDisabled={creating}
            >
              <Tag01Icon size={14} strokeWidth={1.8} />
              {dt.fromTemplate}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={handleCreateBlank}
              isDisabled={creating}
            >
              <Add01Icon size={14} strokeWidth={1.8} />
              {dt.createBlank}
            </Button>
          </div>

          {showTemplates && (
            <div className="mt-3 space-y-1.5 border-t border-[var(--border)]/60 pt-3">
              {templates.length === 0 ? (
                <Text color="muted" className="m-0 px-2 text-xs">
                  {dt.noTemplates}
                </Text>
              ) : (
                templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleCreateFromTemplate(tpl)}
                    disabled={creating /* native button */}
                    className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50"
                  >
                    <span className="font-medium">{tpl.name}</span>
                    {tpl.description && (
                      <Text color="muted" className="m-0 text-xs">
                        {tpl.description}
                      </Text>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </Card.Content>
      </Card>

      {/* ── Правая колонка: содержимое дашборда ─────────────────── */}
      <div className="min-w-0 space-y-4">
        {errorMsg && (
          <Card>
            <Card.Content className="flex items-center justify-between gap-3 p-3">
              <Text color="muted" className="m-0 text-sm">
                {errorMsg}
              </Text>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-[var(--muted)] hover:text-[var(--foreground)]"
                aria-label={dt.dismiss}
              >
                <Cancel01Icon size={14} />
              </button>
            </Card.Content>
          </Card>
        )}

        {detailState === "loading" && (
          <Card>
            <Card.Content className="flex items-center gap-2 p-4 text-sm text-[var(--muted)]">
              <Loading03Icon size={14} className="animate-spin" />
              <span>{dt.loadingDashboard}</span>
            </Card.Content>
          </Card>
        )}

        {detailState === "ready" && activeDash && (
          <DashboardContent
            dashboard={activeDash}
            workspaceId={workspaceId}
            empty={dt.emptyWidgets}
            onChanged={reloadActiveDashboard}
          />
        )}

        {detailState === "idle" && !activeDash && (
          <Card>
            <Card.Content className="flex flex-col items-center gap-2 p-8 text-center">
              <Analytics01Icon size={32} strokeWidth={1.4} className="text-[var(--muted)]" />
              <Text color="muted" className="m-0 text-sm">
                {dashboards.length === 0 ? dt.firstHint : ins.subtitle}
              </Text>
            </Card.Content>
          </Card>
        )}
      </div>
    </div>

    {/* Создание пустого дашборда — модалка вместо window.prompt. */}
    <CreateDashboardDialog
      open={createOpen}
      onOpenChange={(next) => {
        if (!creating) setCreateOpen(next);
      }}
      submitting={creating}
      onSubmit={handleSubmitCreate}
    />
    </>
  );
}

// ── Dashboard content + widgets ───────────────────────────────

interface DashboardContentProps {
  dashboard: DashboardPayload;
  workspaceId: string;
  empty: string;
  onChanged: () => void;
}

function DashboardContent({
  dashboard,
  workspaceId,
  empty,
  onChanged,
}: DashboardContentProps) {
  const { t } = useI18n();
  const dt = t.dashboards;
  const widgets = useMemo(
    () => [...dashboard.widgets].sort((a, b) => a.order - b.order),
    [dashboard.widgets],
  );

  // Состояние редактора: либо новый виджет (`new`), либо редактирование
  // конкретного (`AnalyticsWidget`), либо закрыто (`null`).
  const [editing, setEditing] = useState<AnalyticsWidget | "new" | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = useCallback(
    async (widgetId: string) => {
      if (!window.confirm(dt.confirmRemoveWidget)) return;
      setRemovingId(widgetId);
      try {
        await api.removeWidget(dashboard.id, widgetId);
        onChanged();
      } finally {
        setRemovingId(null);
      }
    },
    [dashboard.id, onChanged, dt.confirmRemoveWidget],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-xl font-bold">{dashboard.name}</h2>
          {dashboard.description && (
            <Text color="muted" className="m-0 text-sm">
              {dashboard.description}
            </Text>
          )}
        </div>
        <Button size="sm" onPress={() => setEditing("new")}>
          <Add01Icon size={14} strokeWidth={1.8} />
          {dt.addWidget}
        </Button>
      </div>

      {widgets.length === 0 ? (
        <Card>
          <Card.Content className="p-6 text-center">
            <Text color="muted" className="m-0 text-sm">
              {empty}
            </Text>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {widgets.map((w) => (
            <WidgetCard
              key={w.id}
              widget={w}
              workspaceId={workspaceId}
              onEdit={() => setEditing(w)}
              onRemove={() => void handleRemove(w.id)}
              isRemoving={removingId === w.id}
            />
          ))}
        </div>
      )}

      {editing !== null && (
        <WidgetEditorDialog
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          workspaceId={workspaceId}
          dashboardId={dashboard.id}
          widget={editing === "new" ? undefined : editing}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}

interface WidgetCardProps {
  widget: AnalyticsWidget;
  workspaceId: string;
  onEdit: () => void;
  onRemove: () => void;
  isRemoving: boolean;
}

function WidgetCard({ widget, workspaceId, onEdit, onRemove, isRemoving }: WidgetCardProps) {
  const { t } = useI18n();
  const dt = t.dashboards;

  const [result, setResult] = useState<AnalyticsResult | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Стабильный ключ запроса — используем его как зависимость useEffect,
  // чтобы переисполнение шло только при реальном изменении содержимого
  // (а не при каждом новом reference после ре-маппинга).
  const queryKey = useMemo(() => JSON.stringify(widget.query ?? null), [widget.query]);

  useEffect(() => {
    if (!widget.query) {
      setState("ready");
      return;
    }

    // Раньше здесь был `lastKey.current === queryKey` ранний выход,
    // который в React StrictMode (двойной mount в dev) приводил к
    // вечному состоянию "loading":
    //   1) Mount #1: ref ← queryKey, setState("loading"), API вызывается.
    //   2) Cleanup #1: `cancelled = true`.
    //   3) Mount #2: ref === queryKey → early return, state остаётся "loading".
    //   4) Resolved API #1: closure видит cancelled=true → setState не зовётся.
    // → виджет завис на "Загрузка виджета...". Дедуп по `queryKey` уже
    // обеспечен зависимостями useEffect — отдельный ref не нужен.
    let cancelled = false;
    setState("loading");
    api
      .executeAnalyticsQuery(workspaceId, widget.query)
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setState("ready");
        setErrorMsg(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState("error");
        setErrorMsg(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [queryKey, workspaceId, widget.query]);

  // Колспан виджета: соблюдаем `size.w` от 1 до 3 (макс. ширина грид-колонок).
  const colSpan = Math.min(Math.max(widget.size.w ?? 1, 1), 3);
  const span =
    colSpan === 3
      ? "md:col-span-2 xl:col-span-3"
      : colSpan === 2
        ? "md:col-span-2 xl:col-span-2"
        : "";

  return (
    <Card className={`min-w-0 ${span}`}>
      <Card.Header>
        <div className="flex items-center justify-between gap-2">
          <Card.Title className="min-w-0 truncate text-sm">{widget.title}</Card.Title>
          <div className="flex shrink-0 items-center gap-1">
            <Chip size="sm" variant="soft" color="default">
              {widget.widgetType}
            </Chip>
            <button
              type="button"
              onClick={onEdit}
              aria-label={dt.editWidget}
              title={dt.editWidget}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
            >
              <Edit02Icon size={12} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={isRemoving}
              aria-label={dt.removeWidget}
              title={dt.removeWidget}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
            >
              <Delete02Icon size={12} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </Card.Header>
      <Card.Content className="px-3 pb-3 pt-0">
        {state === "loading" && (
          <div className="flex items-center gap-2 py-6 text-sm text-[var(--muted)]">
            <Loading03Icon size={14} className="animate-spin" />
            <span>{dt.loadingWidget}</span>
          </div>
        )}
        {state === "error" && (
          <Text color="muted" className="m-0 py-6 text-sm">
            {errorMsg ?? dt.widgetError}
          </Text>
        )}
        {state === "ready" && (
          <WidgetBody widget={widget} result={result} workspaceId={workspaceId} />
        )}
      </Card.Content>
    </Card>
  );
}

function WidgetBody({
  widget,
  result,
  workspaceId,
}: {
  widget: AnalyticsWidget;
  result: AnalyticsResult | null;
  workspaceId: string;
}) {
  const { t, locale } = useI18n();
  const dt = t.dashboards;
  const labels = useLabelResolver(workspaceId);
  const resolved = useResolvedResult(result, labels);

  if (!resolved || resolved.rows.length === 0) {
    return (
      <Text color="muted" className="m-0 py-6 text-center text-sm">
        {dt.noData}
      </Text>
    );
  }

  switch (widget.widgetType) {
    case "kpi":
    case "scorecard":
      return <KpiWidget widget={widget} result={resolved} locale={locale} />;
    case "table":
      return <TableWidget result={resolved} locale={locale} />;
    case "bar_chart":
    case "stacked_bar":
      return (
        <BarWidget
          widget={widget}
          result={resolved}
          locale={locale}
          stacked={widget.widgetType === "stacked_bar"}
        />
      );
    case "line_chart":
      return <LineWidget widget={widget} result={resolved} locale={locale} />;
    case "area_chart":
      return <AreaWidget widget={widget} result={resolved} locale={locale} />;
    case "pie_chart":
      return <PieWidget widget={widget} result={resolved} />;
    case "funnel":
      return <FunnelWidget widget={widget} result={resolved} />;
    default:
      return <TableWidget result={resolved} locale={locale} />;
  }
}

// ── Widget renderers ──────────────────────────────────────────

function pickMetricKey(widget: AnalyticsWidget, columns: string[]): string {
  // Алиас или поле первой метрики из query, иначе — последняя колонка.
  const metric = widget.query?.metrics?.[0];
  if (metric) {
    const alias = metric.alias ?? `${metric.aggregation}_${metric.field}`;
    if (columns.includes(alias)) return alias;
    if (columns.includes(metric.field)) return metric.field;
  }
  return columns[columns.length - 1] ?? "";
}

function pickDimensionKey(widget: AnalyticsWidget, columns: string[]): string {
  const dim = widget.query?.dimensions?.[0];
  if (dim) {
    const alias = dim.alias ?? dim.field;
    if (columns.includes(alias)) return alias;
    if (columns.includes(dim.field)) return dim.field;
  }
  return columns[0] ?? "";
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toDisplay(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function rowsAsRecords(result: AnalyticsResult): Array<Record<string, unknown>> {
  return result.rows.map((r) => r.values);
}

function KpiWidget({
  widget,
  result,
  locale,
}: {
  widget: AnalyticsWidget;
  result: AnalyticsResult;
  locale: Locale;
}) {
  const metricKey = pickMetricKey(widget, result.columns);
  const value = toNumber(result.rows[0]?.values[metricKey]);
  const formatted =
    Math.abs(value) >= 1000
      ? value.toLocaleString()
      : Number.isInteger(value)
        ? String(value)
        : value.toFixed(2);
  return (
    <div className="flex flex-col items-start gap-1 py-2">
      <span className="text-3xl font-bold tabular-nums">{formatted}</span>
      <Text color="muted" className="m-0 text-xs uppercase tracking-wide">
        {humanColumnLabel(metricKey, locale)}
      </Text>
    </div>
  );
}

function TableWidget({ result, locale }: { result: AnalyticsResult; locale: Locale }) {
  const rows = rowsAsRecords(result);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]/60">
            {result.columns.map((c) => (
              <th
                key={c}
                className="px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]"
              >
                {humanColumnLabel(c, locale)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]/40">
          {rows.slice(0, 50).map((row, idx) => (
            <tr key={idx}>
              {result.columns.map((c) => (
                <td key={c} className="px-2 py-1.5 tabular-nums">
                  {toDisplay(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarWidget({
  widget,
  result,
  stacked,
  locale,
}: {
  widget: AnalyticsWidget;
  result: AnalyticsResult;
  stacked: boolean;
  locale: Locale;
}) {
  const dimKey = pickDimensionKey(widget, result.columns);
  const metricKeys = result.columns.filter((c) => c !== dimKey);
  const data = rowsAsRecords(result).map((r) => {
    const out: Record<string, unknown> = { [dimKey]: toDisplay(r[dimKey]) };
    metricKeys.forEach((m) => {
      out[m] = toNumber(r[m]);
    });
    return out;
  });
  return (
    <RechartsAuto className="h-[220px] w-full min-w-0">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey={dimKey}
          tick={{ fontSize: 10 }}
          stroke="var(--muted)"
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" tickLine={false} axisLine={false} width={32} />
        <RechartsTip contentStyle={TOOLTIP_STYLE} />
        {metricKeys.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
        {metricKeys.map((m, i) => (
          <Bar
            key={m}
            dataKey={m}
            name={humanColumnLabel(m, locale)}
            stackId={stacked ? "stack" : undefined}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </RechartsAuto>
  );
}

function LineWidget({
  widget,
  result,
  locale,
}: {
  widget: AnalyticsWidget;
  result: AnalyticsResult;
  locale: Locale;
}) {
  const dimKey = pickDimensionKey(widget, result.columns);
  const metricKeys = result.columns.filter((c) => c !== dimKey);
  const data = rowsAsRecords(result).map((r) => {
    const out: Record<string, unknown> = { [dimKey]: toDisplay(r[dimKey]) };
    metricKeys.forEach((m) => {
      out[m] = toNumber(r[m]);
    });
    return out;
  });
  return (
    <RechartsAuto className="h-[220px] w-full min-w-0">
      <LineChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={dimKey} tick={{ fontSize: 10 }} stroke="var(--muted)" tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" tickLine={false} axisLine={false} width={32} />
        <RechartsTip contentStyle={TOOLTIP_STYLE} />
        {metricKeys.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
        {metricKeys.map((m, i) => (
          <Line
            key={m}
            type="monotone"
            dataKey={m}
            name={humanColumnLabel(m, locale)}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </RechartsAuto>
  );
}

function AreaWidget({
  widget,
  result,
  locale,
}: {
  widget: AnalyticsWidget;
  result: AnalyticsResult;
  locale: Locale;
}) {
  const dimKey = pickDimensionKey(widget, result.columns);
  const metricKeys = result.columns.filter((c) => c !== dimKey);
  const data = rowsAsRecords(result).map((r) => {
    const out: Record<string, unknown> = { [dimKey]: toDisplay(r[dimKey]) };
    metricKeys.forEach((m) => {
      out[m] = toNumber(r[m]);
    });
    return out;
  });
  return (
    <RechartsAuto className="h-[220px] w-full min-w-0">
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
        <defs>
          {metricKeys.map((m, i) => (
            <linearGradient key={m} id={`grad-${m}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={dimKey} tick={{ fontSize: 10 }} stroke="var(--muted)" tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" tickLine={false} axisLine={false} width={32} />
        <RechartsTip contentStyle={TOOLTIP_STYLE} />
        {metricKeys.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
        {metricKeys.map((m, i) => (
          <Area
            key={m}
            type="monotone"
            dataKey={m}
            name={humanColumnLabel(m, locale)}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            fill={`url(#grad-${m})`}
            dot={false}
          />
        ))}
      </AreaChart>
    </RechartsAuto>
  );
}

function PieWidget({ widget, result }: { widget: AnalyticsWidget; result: AnalyticsResult }) {
  const dimKey = pickDimensionKey(widget, result.columns);
  const metricKey = pickMetricKey(widget, result.columns);
  const data = rowsAsRecords(result).map((r) => ({
    name: toDisplay(r[dimKey]),
    value: toNumber(r[metricKey]),
  }));
  return (
    <RechartsAuto className="h-[220px] w-full min-w-0">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="50%"
          outerRadius="80%"
          paddingAngle={2}
          stroke="var(--surface)"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <RechartsTip contentStyle={TOOLTIP_STYLE} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </RechartsAuto>
  );
}

function FunnelWidget({ widget, result }: { widget: AnalyticsWidget; result: AnalyticsResult }) {
  const dimKey = pickDimensionKey(widget, result.columns);
  const metricKey = pickMetricKey(widget, result.columns);
  const items = rowsAsRecords(result).map((r) => ({
    name: toDisplay(r[dimKey]),
    value: toNumber(r[metricKey]),
  }));
  const max = items.reduce((acc, it) => Math.max(acc, it.value), 0) || 1;
  return (
    <div className="space-y-2 py-1">
      {items.map((it, i) => {
        const pct = (it.value / max) * 100;
        return (
          <div key={`${it.name}-${i}`} className="space-y-0.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium">{it.name}</span>
              <span className="tabular-nums text-[var(--muted)]">{it.value.toLocaleString()}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Create dashboard dialog ──────────────────────────────────

interface CreateDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  onSubmit: (payload: { name: string; description?: string }) => Promise<void> | void;
}

/**
 * Модалка «Создать дашборд» — заменяет прежний `window.prompt` для
 * имени. Поля: имя (обязательное) + описание (опциональное).
 *
 * Открытие/закрытие управляется родителем через `open`/`onOpenChange`,
 * сабмит — через `onSubmit`. На время `submitting` поля и кнопки
 * блокируются.
 */
function CreateDashboardDialog({
  open,
  onOpenChange,
  submitting,
  onSubmit,
}: CreateDashboardDialogProps) {
  const { t } = useI18n();
  const dt = t.dashboards;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  // Сбрасываем форму при каждом открытии (чтобы не утекали данные
  // из прошлого сеанса).
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setNameError(null);
    }
  }, [open]);

  const submit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) {
        setNameError(dt.createDialogNameRequired);
        return;
      }
      setNameError(null);
      await onSubmit({
        name: trimmed,
        description: description.trim() || undefined,
      });
    },
    [name, description, onSubmit, dt.createDialogNameRequired],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        from="top"
        className="w-[min(480px,calc(100vw-32px))] max-w-[480px]"
      >
        <DialogHeader>
          <DialogTitle>{dt.createDialogTitle}</DialogTitle>
          <DialogDescription>{dt.createDialogDescription}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">
              {dt.createDialogNameLabel}
              <span className="text-red-500"> *</span>
            </label>
            <Input
              autoFocus
              fullWidth
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder={dt.createDialogNamePlaceholder}
              disabled={submitting}
            />
            {nameError && (
              <p className="m-0 text-[11px] text-red-500">{nameError}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">
              {dt.createDialogDescriptionLabel}
            </label>
            <TextArea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={dt.createDialogDescriptionPlaceholder}
              disabled={submitting}
              className="min-h-[72px] w-full resize-y rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm placeholder:text-muted/50 focus:border-(--accent)/60 focus:outline-none"
            />
          </div>

          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" isDisabled={submitting}>
                {dt.createDialogCancel}
              </Button>
            </DialogClose>
            <Button type="submit" isDisabled={submitting}>
              {submitting ? (
                <>
                  <Loading03Icon size={14} className="animate-spin" />
                  <span>{dt.editorSaving}</span>
                </>
              ) : (
                dt.createDialogSubmit
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

