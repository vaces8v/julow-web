"use client";

/**
 * WidgetEditorDialog — visual builder для виджета дашборда.
 *
 * Полностью на HeroUI компонентах (Select / DatePicker / Input / Button),
 * никаких native <select>/<input type="date">.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Calendar,
  DatePicker,
  Input,
  ListBox,
  ListBoxItem,
  Select,
  Text,
} from "@heroui/react";
import {
  Add01Icon,
  ArrowDown01Icon,
  Cancel01Icon,
  Loading03Icon,
  PlayIcon,
} from "hugeicons-react";
import { CalendarDate, parseDate } from "@internationalized/date";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n, type Locale } from "@/i18n/context";
import { useLabelResolver } from "@/components/pages/dashboard-label-resolver";
import {
  api,
  type AnalyticsAggregation,
  type AnalyticsDataSourceSchema,
  type AnalyticsFieldDescriptor,
  type AnalyticsFilter,
  type AnalyticsFilterOperator,
  type AnalyticsQuery,
  type AnalyticsResult,
  type AnalyticsSchemaPayload,
  type AnalyticsSortOrder,
  type AnalyticsTimeGranularity,
  type AnalyticsWidget,
  type WidgetType,
} from "@/lib/api";

// ── Bilingual pretty labels ─────────────────────────────────────────

const WIDGET_TYPES: WidgetType[] = [
  "kpi",
  "scorecard",
  "table",
  "bar_chart",
  "stacked_bar",
  "line_chart",
  "area_chart",
  "pie_chart",
  "funnel",
];

const WIDGET_TYPE_LABELS: Record<Locale, Record<WidgetType, string>> = {
  ru: {
    kpi: "KPI / счётчик",
    scorecard: "Текстовый scorecard",
    table: "Таблица",
    bar_chart: "Столбчатый график",
    stacked_bar: "Столбчатый (стек)",
    line_chart: "Линейный график",
    area_chart: "Областной график",
    pie_chart: "Круговая диаграмма",
    funnel: "Воронка",
  },
  en: {
    kpi: "KPI / counter",
    scorecard: "Text scorecard",
    table: "Table",
    bar_chart: "Bar chart",
    stacked_bar: "Stacked bar",
    line_chart: "Line chart",
    area_chart: "Area chart",
    pie_chart: "Pie chart",
    funnel: "Funnel",
  },
  de: {
    kpi: "KPI / Zähler",
    scorecard: "Text-Scorecard",
    table: "Tabelle",
    bar_chart: "Balkendiagramm",
    stacked_bar: "Gestapelte Balken",
    line_chart: "Liniendiagramm",
    area_chart: "Flächendiagramm",
    pie_chart: "Kreisdiagramm",
    funnel: "Trichter",
  },
};

const AGGREGATION_LABELS: Record<Locale, Record<AnalyticsAggregation, string>> = {
  ru: {
    count: "Количество",
    count_distinct: "Уникальных",
    sum: "Сумма",
    avg: "Среднее",
    min: "Минимум",
    max: "Максимум",
  },
  en: {
    count: "Count",
    count_distinct: "Distinct",
    sum: "Sum",
    avg: "Average",
    min: "Minimum",
    max: "Maximum",
  },
  de: {
    count: "Anzahl",
    count_distinct: "Eindeutige",
    sum: "Summe",
    avg: "Durchschnitt",
    min: "Minimum",
    max: "Maximum",
  },
};

const FILTER_OP_LABELS: Record<Locale, Record<AnalyticsFilterOperator, string>> = {
  ru: {
    eq: "=",
    neq: "≠",
    in: "В списке",
    not_in: "Не в списке",
    gt: ">",
    gte: "≥",
    lt: "<",
    lte: "≤",
    between: "Между",
    contains: "Содержит",
    starts_with: "Начинается с",
    is_null: "Пусто",
    is_not_null: "Не пусто",
  },
  en: {
    eq: "Equals",
    neq: "Not equals",
    in: "In",
    not_in: "Not in",
    gt: "Greater than",
    gte: "Greater or equal",
    lt: "Less than",
    lte: "Less or equal",
    between: "Between",
    contains: "Contains",
    starts_with: "Starts with",
    is_null: "Is empty",
    is_not_null: "Is not empty",
  },
  de: {
    eq: "Gleich",
    neq: "Ungleich",
    in: "In",
    not_in: "Nicht in",
    gt: "Größer als",
    gte: "Größer / gleich",
    lt: "Kleiner als",
    lte: "Kleiner / gleich",
    between: "Zwischen",
    contains: "Enthält",
    starts_with: "Beginnt mit",
    is_null: "Ist leer",
    is_not_null: "Nicht leer",
  },
};

const TIME_GRANULARITY_LABELS: Record<Locale, Record<AnalyticsTimeGranularity, string>> = {
  ru: {
    hour: "Час",
    day: "День",
    week: "Неделя",
    month: "Месяц",
    quarter: "Квартал",
    year: "Год",
  },
  en: {
    hour: "Hour",
    day: "Day",
    week: "Week",
    month: "Month",
    quarter: "Quarter",
    year: "Year",
  },
  de: {
    hour: "Stunde",
    day: "Tag",
    week: "Woche",
    month: "Monat",
    quarter: "Quartal",
    year: "Jahr",
  },
};

const SORT_LABELS: Record<Locale, Record<AnalyticsSortOrder, string>> = {
  ru: { asc: "По возрастанию", desc: "По убыванию" },
  en: { asc: "Ascending", desc: "Descending" },
  de: { asc: "Aufsteigend", desc: "Absteigend" },
};

const DATA_SOURCE_LABELS: Record<Locale, Record<string, string>> = {
  ru: {
    tasks: "Задачи",
    task_status_history: "История статусов задач",
    sprints: "Спринты",
    sprint_burndown: "Burndown спринтов",
    sprint_velocity: "Velocity спринтов",
    projects: "Проекты",
    project_progress: "Прогресс проектов",
    time_entries: "Учёт времени",
    workload: "Загрузка команды",
    workspaces: "Воркспейсы",
  },
  en: {
    tasks: "Tasks",
    task_status_history: "Task status history",
    sprints: "Sprints",
    sprint_burndown: "Sprint burndown",
    sprint_velocity: "Sprint velocity",
    projects: "Projects",
    project_progress: "Project progress",
    time_entries: "Time entries",
    workload: "Team workload",
    workspaces: "Workspaces",
  },
  de: {
    tasks: "Aufgaben",
    task_status_history: "Statusverlauf",
    sprints: "Sprints",
    sprint_burndown: "Sprint-Burndown",
    sprint_velocity: "Sprint-Velocity",
    projects: "Projekte",
    project_progress: "Projektfortschritt",
    time_entries: "Zeiteinträge",
    workload: "Team-Auslastung",
    workspaces: "Workspaces",
  },
};

const ENUM_VALUE_LABELS: Record<Locale, Record<string, string>> = {
  ru: {
    active: "Активна",
    archived: "Архив",
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    critical: "Критичный",
    created_at: "Создана",
    updated_at: "Обновлена",
    due_date: "Срок",
  },
  en: {
    active: "Active",
    archived: "Archived",
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
    created_at: "Created at",
    updated_at: "Updated at",
    due_date: "Due date",
  },
  de: {
    active: "Aktiv",
    archived: "Archiviert",
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
    critical: "Kritisch",
    created_at: "Erstellt am",
    updated_at: "Aktualisiert am",
    due_date: "Fälligkeitsdatum",
  },
};

const FALLBACK_FILTER_OPS: AnalyticsFilterOperator[] = [
  "eq",
  "neq",
  "in",
  "not_in",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "contains",
  "starts_with",
  "is_null",
  "is_not_null",
];

const FALLBACK_AGGS: AnalyticsAggregation[] = [
  "count",
  "count_distinct",
  "sum",
  "avg",
  "min",
  "max",
];

const TIME_GRANULARITIES: AnalyticsTimeGranularity[] = [
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year",
];

// ── Helpers per field type ─────────────────────────────────────────

function operatorsForField(field?: AnalyticsFieldDescriptor): AnalyticsFilterOperator[] {
  if (!field) return FALLBACK_FILTER_OPS;
  switch (field.type) {
    case "boolean":
      return ["eq", "neq", "is_null", "is_not_null"];
    case "uuid":
    case "enum":
      return ["eq", "neq", "in", "not_in", "is_null", "is_not_null"];
    case "datetime":
    case "date":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is_null", "is_not_null"];
    case "integer":
    case "float":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is_null", "is_not_null"];
    case "string":
      return ["eq", "neq", "in", "not_in", "contains", "starts_with", "is_null", "is_not_null"];
    default:
      return FALLBACK_FILTER_OPS;
  }
}

function isUserField(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n === "user_id" ||
    n === "assignee_id" ||
    n === "reporter_id" ||
    n === "owner_id" ||
    n === "created_by" ||
    n === "updated_by"
  );
}

function isProjectField(name: string): boolean {
  return name.toLowerCase() === "project_id";
}

// ── Date helpers ───────────────────────────────────────────────────

/** ISO → CalendarDate, безопасно. */
function isoToCalendarDate(iso: string | null | undefined): CalendarDate | null {
  if (!iso) return null;
  try {
    return parseDate(iso.slice(0, 10));
  } catch {
    return null;
  }
}

/** CalendarDate + флаг конца дня → ISO с временем. */
function calendarDateToISO(d: CalendarDate | null, endOfDay = false): string {
  if (!d) return "";
  const yyyy = String(d.year).padStart(4, "0");
  const mm = String(d.month).padStart(2, "0");
  const dd = String(d.day).padStart(2, "0");
  return endOfDay
    ? `${yyyy}-${mm}-${dd}T23:59:59`
    : `${yyyy}-${mm}-${dd}T00:00:00`;
}

// ── Component ───────────────────────────────────────────────────────

interface WidgetEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  dashboardId: string;
  widget?: AnalyticsWidget;
  onSaved: () => void;
}

export function WidgetEditorDialog({
  open,
  onOpenChange,
  workspaceId,
  dashboardId,
  widget,
  onSaved,
}: WidgetEditorDialogProps) {
  const { t, locale } = useI18n();
  const dt = t.dashboards;
  const isEditing = !!widget;
  const labels = useLabelResolver(workspaceId);

  // ── Schema ─────────────────────────────────────────────────
  const [schema, setSchema] = useState<AnalyticsSchemaPayload | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || schema) return;
    api
      .getAnalyticsSchema()
      .then(setSchema)
      .catch((err: unknown) =>
        setSchemaError(err instanceof Error ? err.message : String(err)),
      );
  }, [open, schema]);

  // ── Form state ─────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [widgetType, setWidgetType] = useState<WidgetType>("table");
  const [dataSource, setDataSource] = useState<string>("tasks");
  const [metrics, setMetrics] = useState<
    Array<{ field: string; aggregation: AnalyticsAggregation; alias?: string }>
  >([{ field: "*", aggregation: "count" }]);
  const [dimensions, setDimensions] = useState<
    Array<{ field: string; timeGranularity?: AnalyticsTimeGranularity; alias?: string }>
  >([]);
  const [filters, setFilters] = useState<AnalyticsFilter[]>([]);
  const [sortRules, setSortRules] = useState<
    Array<{ field: string; order: AnalyticsSortOrder }>
  >([]);
  const [limit, setLimit] = useState<string>("");
  const [dateStart, setDateStart] = useState<CalendarDate | null>(null);
  const [dateEnd, setDateEnd] = useState<CalendarDate | null>(null);

  // ── Hydrate from existing widget ──────────────────────────
  useEffect(() => {
    if (!open) return;
    if (widget) {
      setTitle(widget.title);
      setWidgetType((widget.widgetType as WidgetType) ?? "table");
      const q = widget.query;
      if (q) {
        setDataSource(q.dataSource);
        setMetrics(
          q.metrics.length > 0
            ? q.metrics.map((m) => ({
                field: m.field,
                aggregation: m.aggregation,
                alias: m.alias,
              }))
            : [{ field: "*", aggregation: "count" }],
        );
        setDimensions(
          q.dimensions.map((d) => ({
            field: d.field,
            timeGranularity: d.timeGranularity,
            alias: d.alias,
          })),
        );
        setFilters(q.filters.map((f) => ({ ...f })));
        setSortRules(q.sort.map((s) => ({ field: s.field, order: s.order })));
        setLimit(q.limit ? String(q.limit) : "");
        setDateStart(isoToCalendarDate(q.dateRange?.start));
        setDateEnd(isoToCalendarDate(q.dateRange?.end));
      }
    } else {
      setTitle("");
      setWidgetType("table");
      setDataSource("tasks");
      setMetrics([{ field: "*", aggregation: "count" }]);
      setDimensions([]);
      setFilters([]);
      setSortRules([]);
      setLimit("");
      setDateStart(null);
      setDateEnd(null);
    }
  }, [open, widget]);

  // ── Derived: schema for active data source ────────────────
  const activeSchema: AnalyticsDataSourceSchema | null = useMemo(() => {
    return schema?.dataSources.find((ds) => ds.dataSource === dataSource) ?? null;
  }, [schema, dataSource]);

  const fields = activeSchema?.fields ?? [];
  const supportedAggs = (activeSchema?.supportedAggregations ?? []).filter(Boolean);
  const aggOptions = (
    supportedAggs.length > 0 ? supportedAggs : (FALLBACK_AGGS as readonly string[])
  ) as AnalyticsAggregation[];

  // ── Build query for preview/submit ────────────────────────
  const builtQuery: AnalyticsQuery = useMemo(() => {
    return {
      dataSource,
      metrics: metrics
        .filter((m) => m.field.trim() !== "")
        .map((m) => ({
          field: m.field,
          aggregation: m.aggregation,
          ...(m.alias?.trim() ? { alias: m.alias.trim() } : {}),
        })),
      dimensions: dimensions
        .filter((d) => d.field.trim() !== "")
        .map((d) => ({
          field: d.field,
          ...(d.timeGranularity ? { timeGranularity: d.timeGranularity } : {}),
          ...(d.alias?.trim() ? { alias: d.alias.trim() } : {}),
        })),
      filters: filters.filter((f) => f.field.trim() !== ""),
      sort: sortRules.filter((s) => s.field.trim() !== ""),
      ...(dateStart || dateEnd
        ? {
            dateRange: {
              ...(dateStart ? { start: calendarDateToISO(dateStart, false) } : {}),
              ...(dateEnd ? { end: calendarDateToISO(dateEnd, true) } : {}),
            },
          }
        : {}),
      ...(limit && /^\d+$/.test(limit) ? { limit: Number(limit) } : {}),
      raw: false,
    };
  }, [dataSource, metrics, dimensions, filters, sortRules, dateStart, dateEnd, limit]);

  // ── Preview ────────────────────────────────────────────────
  const [preview, setPreview] = useState<AnalyticsResult | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);

  const runPreview = useCallback(async () => {
    setPreviewState("loading");
    setPreviewError(null);
    try {
      const r = await api.executeAnalyticsQuery(workspaceId, builtQuery);
      setPreview(r);
      setPreviewState("ok");
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
      setPreviewState("error");
    }
  }, [builtQuery, workspaceId]);

  // ── Submit ─────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canSave = title.trim() !== "" && metrics.length > 0;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (widget) {
        await api.updateWidget(dashboardId, widget.id, {
          title: title.trim(),
          query: builtQuery,
        });
      } else {
        await api.addWidget(dashboardId, {
          title: title.trim(),
          widgetType,
          query: builtQuery,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [canSave, widget, dashboardId, title, builtQuery, widgetType, onSaved, onOpenChange]);

  // ── Helpers for nested arrays ──────────────────────────────

  const addMetric = () =>
    setMetrics((prev) => [...prev, { field: "*", aggregation: "count" }]);
  const removeMetric = (i: number) =>
    setMetrics((prev) => prev.filter((_, idx) => idx !== i));
  const updateMetric = (i: number, patch: Partial<(typeof metrics)[number]>) =>
    setMetrics((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  const addDimension = () => {
    const groupable = fields.find((f) => f.groupable);
    setDimensions((prev) => [...prev, { field: groupable?.name ?? "" }]);
  };
  const removeDimension = (i: number) =>
    setDimensions((prev) => prev.filter((_, idx) => idx !== i));
  const updateDimension = (i: number, patch: Partial<(typeof dimensions)[number]>) =>
    setDimensions((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const addFilter = () => {
    const filterable = fields.find((f) => f.filterable);
    setFilters((prev) => [
      ...prev,
      { field: filterable?.name ?? "", operator: "eq", value: "" },
    ]);
  };
  const removeFilter = (i: number) =>
    setFilters((prev) => prev.filter((_, idx) => idx !== i));
  const updateFilter = (i: number, patch: Partial<AnalyticsFilter>) =>
    setFilters((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const addSort = () => {
    const sortable = fields.find((f) => f.sortable);
    setSortRules((prev) => [...prev, { field: sortable?.name ?? "", order: "desc" }]);
  };
  const removeSort = (i: number) =>
    setSortRules((prev) => prev.filter((_, idx) => idx !== i));
  const updateSort = (i: number, patch: Partial<(typeof sortRules)[number]>) =>
    setSortRules((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  // ── Render helpers — common options ───────────────────────

  const widgetTypeOptions = WIDGET_TYPES.map((w) => ({
    value: w,
    label: WIDGET_TYPE_LABELS[locale][w],
  }));

  const dataSourceOptions =
    schema?.dataSources.map((ds) => ({
      value: ds.dataSource,
      label: DATA_SOURCE_LABELS[locale][ds.dataSource] ?? ds.dataSource,
    })) ?? [{ value: dataSource, label: dataSource }];

  const aggregationOptions = aggOptions.map((a) => ({
    value: a,
    label: AGGREGATION_LABELS[locale][a] ?? a,
  }));

  const sortOrderOptions: Array<{ value: AnalyticsSortOrder; label: string }> = [
    { value: "asc", label: SORT_LABELS[locale].asc },
    { value: "desc", label: SORT_LABELS[locale].desc },
  ];

  const granularityOptions: Array<{ value: string; label: string }> = [
    { value: "", label: dt.editorNoGranularity },
    ...TIME_GRANULARITIES.map((g) => ({
      value: g,
      label: TIME_GRANULARITY_LABELS[locale][g],
    })),
  ];

  // ── Render ─────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent from="top" className="!max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? dt.editorTitleEdit : dt.editorTitleNew}</DialogTitle>
          <DialogDescription>{dt.editorDescription}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto px-1 py-1">
          {schemaError && <ErrorRow message={schemaError} />}

          {/* ── Basics ─────────────────────────────────────── */}
          <Section title={dt.editorBasics}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={dt.editorTitle}>
                <Input
                  fullWidth
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={dt.editorTitlePlaceholder}
                />
              </Field>
              <Field label={dt.editorWidgetType}>
                <HeroSelect
                  value={widgetType}
                  onChange={(v) => setWidgetType(v as WidgetType)}
                  options={widgetTypeOptions}
                />
              </Field>
            </div>
            <Field label={dt.editorDataSource}>
              <HeroSelect
                value={dataSource}
                onChange={setDataSource}
                options={dataSourceOptions}
              />
              {activeSchema?.description && (
                <Text color="muted" className="m-0 mt-1 text-xs">
                  {activeSchema.description}
                </Text>
              )}
            </Field>
          </Section>

          {/* ── Metrics ────────────────────────────────────── */}
          <Section
            title={dt.editorMetrics}
            action={<SmallAddButton onClick={addMetric} label={dt.editorAdd} />}
          >
            {metrics.length === 0 ? (
              <Text color="muted" className="m-0 text-sm">
                {dt.editorNoMetrics}
              </Text>
            ) : (
              metrics.map((m, i) => (
                <Row key={i} onRemove={() => removeMetric(i)}>
                  <FieldSelect
                    fields={fields}
                    value={m.field}
                    onChange={(v) => updateMetric(i, { field: v })}
                    allowStar
                  />
                  <HeroSelect
                    value={m.aggregation}
                    onChange={(v) =>
                      updateMetric(i, { aggregation: v as AnalyticsAggregation })
                    }
                    options={aggregationOptions}
                  />
                  <Input
                    fullWidth
                    value={m.alias ?? ""}
                    onChange={(e) => updateMetric(i, { alias: e.target.value })}
                    placeholder={dt.editorAliasPlaceholder}
                  />
                </Row>
              ))
            )}
          </Section>

          {/* ── Dimensions ─────────────────────────────────── */}
          <Section
            title={dt.editorDimensions}
            action={<SmallAddButton onClick={addDimension} label={dt.editorAdd} />}
          >
            {dimensions.length === 0 ? (
              <Text color="muted" className="m-0 text-sm">
                {dt.editorNoDimensions}
              </Text>
            ) : (
              dimensions.map((d, i) => {
                const fieldDesc = fields.find((f) => f.name === d.field);
                const showGranularity = fieldDesc?.timeGranularitySupported;
                return (
                  <Row key={i} onRemove={() => removeDimension(i)}>
                    <FieldSelect
                      fields={fields}
                      value={d.field}
                      onChange={(v) => updateDimension(i, { field: v })}
                      groupableOnly
                    />
                    {showGranularity ? (
                      <HeroSelect
                        value={d.timeGranularity ?? ""}
                        onChange={(v) =>
                          updateDimension(i, {
                            timeGranularity: v ? (v as AnalyticsTimeGranularity) : undefined,
                          })
                        }
                        options={granularityOptions}
                      />
                    ) : (
                      <div />
                    )}
                    <Input
                      fullWidth
                      value={d.alias ?? ""}
                      onChange={(e) => updateDimension(i, { alias: e.target.value })}
                      placeholder={dt.editorAliasPlaceholder}
                    />
                  </Row>
                );
              })
            )}
          </Section>

          {/* ── Filters ────────────────────────────────────── */}
          <Section
            title={dt.editorFilters}
            action={<SmallAddButton onClick={addFilter} label={dt.editorAdd} />}
          >
            {filters.length === 0 ? (
              <Text color="muted" className="m-0 text-sm">
                {dt.editorNoFilters}
              </Text>
            ) : (
              filters.map((f, i) => {
                const fieldDesc = fields.find((fd) => fd.name === f.field);
                const ops = operatorsForField(fieldDesc);
                const isUnary =
                  f.operator === "is_null" || f.operator === "is_not_null";
                const isBetween = f.operator === "between";
                return (
                  <Row
                    key={i}
                    onRemove={() => removeFilter(i)}
                    cols={isBetween ? 5 : 4}
                  >
                    <FieldSelect
                      fields={fields}
                      value={f.field}
                      onChange={(v) => updateFilter(i, { field: v })}
                      filterableOnly
                    />
                    <HeroSelect
                      value={f.operator}
                      onChange={(v) =>
                        updateFilter(i, { operator: v as AnalyticsFilterOperator })
                      }
                      options={ops.map((op) => ({
                        value: op,
                        label: FILTER_OP_LABELS[locale][op],
                      }))}
                    />
                    {isUnary ? (
                      <div className="col-span-2 flex items-center text-xs text-[var(--muted)]">
                        {dt.editorNoValueNeeded}
                      </div>
                    ) : (
                      <>
                        <ValueControl
                          field={fieldDesc}
                          locale={locale}
                          value={f.value}
                          onChange={(v) => updateFilter(i, { value: v })}
                          userOptions={labels.userOptions}
                          projectOptions={labels.projectOptions}
                        />
                        {isBetween && (
                          <ValueControl
                            field={fieldDesc}
                            locale={locale}
                            value={f.valueTo ?? ""}
                            onChange={(v) => updateFilter(i, { valueTo: v })}
                            userOptions={labels.userOptions}
                            projectOptions={labels.projectOptions}
                          />
                        )}
                      </>
                    )}
                  </Row>
                );
              })
            )}
          </Section>

          {/* ── Sort ──────────────────────────────────────── */}
          <Section
            title={dt.editorSort}
            action={<SmallAddButton onClick={addSort} label={dt.editorAdd} />}
          >
            {sortRules.length === 0 ? (
              <Text color="muted" className="m-0 text-sm">
                {dt.editorNoSort}
              </Text>
            ) : (
              sortRules.map((s, i) => (
                <Row key={i} onRemove={() => removeSort(i)} cols={2}>
                  <FieldSelect
                    fields={fields}
                    value={s.field}
                    onChange={(v) => updateSort(i, { field: v })}
                  />
                  <HeroSelect
                    value={s.order}
                    onChange={(v) => updateSort(i, { order: v as AnalyticsSortOrder })}
                    options={sortOrderOptions}
                  />
                </Row>
              ))
            )}
          </Section>

          {/* ── Misc ──────────────────────────────────────── */}
          <Section title={dt.editorMisc}>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label={dt.editorLimit}>
                <Input
                  fullWidth
                  type="number"
                  min="0"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="100"
                />
              </Field>
              <Field label={dt.editorDateFrom}>
                <HeroDatePicker
                  value={dateStart}
                  onChange={setDateStart}
                  placeholder={dt.editorDateFrom}
                />
              </Field>
              <Field label={dt.editorDateTo}>
                <HeroDatePicker
                  value={dateEnd}
                  onChange={setDateEnd}
                  placeholder={dt.editorDateTo}
                />
              </Field>
            </div>
          </Section>

          {/* ── Preview ───────────────────────────────────── */}
          <Section
            title={dt.editorPreview}
            action={
              <Button
                size="sm"
                variant="secondary"
                onPress={() => void runPreview()}
                isDisabled={previewState === "loading"}
              >
                {previewState === "loading" ? (
                  <Loading03Icon size={14} className="animate-spin" />
                ) : (
                  <PlayIcon size={14} strokeWidth={1.8} />
                )}
                {dt.editorRun}
              </Button>
            }
          >
            {previewState === "error" && previewError && <ErrorRow message={previewError} />}
            {previewState === "ok" && preview && (
              <PreviewTable
                result={preview}
                emptyLabel={dt.noData}
                resolveCell={labels.resolveCell}
              />
            )}
            {previewState === "idle" && (
              <Text color="muted" className="m-0 text-sm">
                {dt.editorRunHint}
              </Text>
            )}
          </Section>
        </div>

        {saveError && <ErrorRow message={saveError} />}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" size="sm">
              {t.common.cancel}
            </Button>
          </DialogClose>
          <Button
            size="sm"
            onPress={() => void handleSave()}
            isDisabled={!canSave || saving}
          >
            {saving ? dt.editorSaving : isEditing ? dt.editorSave : dt.editorCreate}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)]/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold">{title}</h3>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      <span className="text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function Row({
  children,
  onRemove,
  cols = 3,
}: {
  children: React.ReactNode;
  onRemove: () => void;
  cols?: number;
}) {
  const gridCols =
    cols === 5
      ? "grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
      : cols === 4
        ? "grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto]"
        : cols === 2
          ? "grid-cols-1 sm:grid-cols-[1fr_1fr_auto]"
          : "grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto]";
  return (
    <div className={`grid items-center gap-2 ${gridCols}`}>
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="remove"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Cancel01Icon size={14} />
      </button>
    </div>
  );
}

// ── HeroUI Select wrapper ──
function HeroSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  // Если value не в options, добавим его в начало, чтобы Select не сбрасывался.
  const all =
    value && !options.find((o) => o.value === value)
      ? [{ value, label: value }, ...options]
      : options;
  const current = all.find((o) => o.value === value);
  return (
    <Select
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key != null) onChange(String(key));
      }}
      className="block"
    >
      <Select.Trigger className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-transparent px-3 text-sm text-foreground outline-none transition-colors hover:bg-[var(--surface-secondary)]/40 focus-visible:border-accent/60">
        <Select.Value className="min-w-0 truncate">
          {current?.label ?? placeholder ?? "—"}
        </Select.Value>
        <ArrowDown01Icon size={12} strokeWidth={2} className="opacity-60" />
      </Select.Trigger>
      <Select.Popover className="z-50 min-w-[var(--trigger-width)] rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] p-1 shadow-lg">
        <ListBox className="max-h-64 overflow-auto outline-none">
          {all.map((opt) => (
            <ListBoxItem
              key={opt.value}
              id={opt.value}
              textValue={opt.label}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none hover:bg-[var(--surface-secondary)] data-[selected]:bg-accent/10 data-[selected]:text-accent"
            >
              {opt.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

// ── HeroUI DatePicker wrapper ──
function HeroDatePicker({
  value,
  onChange,
  placeholder,
}: {
  value: CalendarDate | null;
  onChange: (v: CalendarDate | null) => void;
  placeholder?: string;
}) {
  return (
    <DatePicker value={value} onChange={onChange}>
      <DatePicker.Trigger className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-transparent px-3 text-sm text-foreground outline-none transition-colors hover:bg-[var(--surface-secondary)]/40 focus-visible:border-accent/60">
        <span className="min-w-0 flex-1 truncate text-left">
          {value ? value.toString() : (placeholder ?? "—")}
        </span>
        <DatePicker.TriggerIndicator />
      </DatePicker.Trigger>
      <DatePicker.Popover>
        <Calendar />
      </DatePicker.Popover>
    </DatePicker>
  );
}

// ── Field select (combo of field name + type hint) ──
function FieldSelect({
  fields,
  value,
  onChange,
  filterableOnly,
  groupableOnly,
  allowStar,
}: {
  fields: AnalyticsFieldDescriptor[];
  value: string;
  onChange: (v: string) => void;
  filterableOnly?: boolean;
  groupableOnly?: boolean;
  allowStar?: boolean;
}) {
  const filtered = fields.filter((f) => {
    if (filterableOnly && !f.filterable) return false;
    if (groupableOnly && !f.groupable) return false;
    return true;
  });
  const options = [
    ...(allowStar ? [{ value: "*", label: "* (any)" }] : []),
    ...filtered.map((f) => ({
      value: f.name,
      label: f.description ? `${f.name} — ${f.description}` : f.name,
    })),
  ];
  return <HeroSelect value={value} onChange={onChange} options={options} />;
}

// ── Value control per field type ──
function ValueControl({
  field,
  locale,
  value,
  onChange,
  userOptions,
  projectOptions,
}: {
  field: AnalyticsFieldDescriptor | undefined;
  locale: Locale;
  value: string;
  onChange: (v: string) => void;
  userOptions: Array<{ value: string; label: string }>;
  projectOptions: Array<{ value: string; label: string }>;
}) {
  // Enum поле → Select со значениями (с подписями из ENUM_VALUE_LABELS).
  if (field && field.type === "enum" && field.allowedValues && field.allowedValues.length > 0) {
    return (
      <HeroSelect
        value={value}
        onChange={onChange}
        options={field.allowedValues.map((v) => ({
          value: v,
          label: ENUM_VALUE_LABELS[locale][v] ?? v,
        }))}
      />
    );
  }
  // Boolean → Select true/false
  if (field?.type === "boolean") {
    return (
      <HeroSelect
        value={value}
        onChange={onChange}
        options={[
          { value: "true", label: locale === "ru" ? "Да" : locale === "de" ? "Ja" : "True" },
          { value: "false", label: locale === "ru" ? "Нет" : locale === "de" ? "Nein" : "False" },
        ]}
      />
    );
  }
  // user_id / assignee_id / reporter_id и т.д. → Select из workspace members
  if (field && isUserField(field.name)) {
    return <HeroSelect value={value} onChange={onChange} options={userOptions} />;
  }
  // project_id → Select из проектов воркспейса
  if (field && isProjectField(field.name)) {
    return <HeroSelect value={value} onChange={onChange} options={projectOptions} />;
  }
  // datetime / date → DatePicker
  if (field?.type === "datetime" || field?.type === "date") {
    const parsed = isoToCalendarDate(value);
    return (
      <HeroDatePicker
        value={parsed}
        onChange={(d) => onChange(calendarDateToISO(d, false))}
      />
    );
  }
  // По умолчанию — текстовый Input.
  return (
    <Input
      fullWidth
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="value"
    />
  );
}

function SmallAddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
    >
      <Add01Icon size={12} strokeWidth={2} />
      {label}
    </button>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
      {message}
    </div>
  );
}

function PreviewTable({
  result,
  emptyLabel,
  resolveCell,
}: {
  result: AnalyticsResult;
  emptyLabel: string;
  resolveCell: (column: string, value: unknown) => string;
}) {
  if (result.rows.length === 0) {
    return (
      <Text color="muted" className="m-0 py-4 text-center text-sm">
        {emptyLabel}
      </Text>
    );
  }
  return (
    <div className="max-h-[200px] overflow-auto rounded-md border border-[var(--border)]/60">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-[var(--surface)]">
          <tr className="border-b border-[var(--border)]/60">
            {result.columns.map((c) => (
              <th
                key={c}
                className="px-2 py-1 text-left font-semibold uppercase tracking-wider text-[var(--muted)]"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]/40">
          {result.rows.slice(0, 50).map((r, idx) => (
            <tr key={idx}>
              {result.columns.map((c) => (
                <td key={c} className="px-2 py-1 tabular-nums">
                  {resolveCell(c, r.values[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
