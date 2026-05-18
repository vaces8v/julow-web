"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, Text } from "@heroui/react";
import {
  ArrowUpRight01Icon,
  ArrowDownRight01Icon,
  Analytics01Icon,
  Idea01Icon,
  UserGroupIcon,
  FlowIcon,
  RefreshIcon,
  Loading03Icon,
} from "hugeicons-react";
import {
  Area, AreaChart, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTip,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend,
  ComposedChart,
} from "recharts";
import { useI18n } from "@/i18n/context";
import { motion } from "motion/react";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { RechartsAuto } from "@/components/ui/recharts-auto";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import { api, type TaskPayload } from "@/lib/api";
import { useLabelResolver } from "@/components/pages/dashboard-label-resolver";

const CAT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f97316"];
const AVATAR_COLORS = ["#3b82f6", "#8b5cf6", "#f97316", "#06b6d4", "#22c55e", "#ec4899"];

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

type TeamMemberRow = {
  id: string;
  name: string;
  role: string;
  done: number;
  inProgress: number;
  pts: number;
  focus: number;
};

type FlowStageRow = {
  value: number;
  max: number;
  color: string;
  conv?: string;
};

/**
 * Status-классификация по подстрокам, чтобы ловить:
 *   - английские варианты (done / DONE / "In Progress");
 *   - русские названия колонок ("Готово", "В работе", "Ревью");
 *   - снейк/кебаб-кейс (in_progress / in-progress);
 *   - workflow-status-ID (если содержит человекочитаемый суффикс).
 * Раньше строгое `===` пропускало любое значение, отличное от
 * 3 захардкоженных вариантов, из-за чего «Готово»-задачи не
 * считались выполненными и метрики были нулевыми.
 */
function isDoneStatus(status: string) {
  const s = status?.toLowerCase() ?? "";
  return (
    s.includes("done") ||
    s.includes("complete") ||
    s.includes("closed") ||
    s.includes("готов") ||
    s.includes("заверш") ||
    s.includes("выполн")
  );
}

function isInProgressStatus(status: string) {
  const s = status?.toLowerCase() ?? "";
  return (
    s.includes("progress") ||
    s.includes("active") ||
    s.includes("doing") ||
    s.includes("работ") ||
    s.includes("в процесс")
  );
}

function isReviewStatus(status: string) {
  const s = status?.toLowerCase() ?? "";
  return (
    s.includes("review") ||
    s.includes("ревью") ||
    s.includes("проверк")
  );
}

function safeDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}


function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const value = Math.round(((current - previous) / previous) * 100);
  return `${value > 0 ? "+" : ""}${value}%`;
}

function countBetween(tasks: TaskPayload[], from: Date, to: Date, dateSelector: (task: TaskPayload) => Date | null) {
  return tasks.filter((task) => {
    const date = dateSelector(task);
    return date && date >= from && date < to;
  }).length;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    queueMicrotask(() => setMatches(mq.matches));
    const handler = () => setMatches(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

type StatAccent = "accent" | "emerald" | "amber" | "violet";

const STAT_ACCENT_HEX: Record<StatAccent, string> = {
  accent: "#3b82f6",
  emerald: "#22c55e",
  amber: "#f59e0b",
  violet: "#a855f7",
};

const STAT_ACCENT_BG: Record<StatAccent, string> = {
  accent: "bg-accent/10 text-accent",
  emerald: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/10 text-amber-600",
  violet: "bg-violet-500/10 text-violet-600",
};

function StatCard({
  label, value, unit, sub, change, up, neutral, delay = 0, spark, accent = "accent", icon: Icon,
  sparkLabel,
  sparkValueFormat,
}: {
  label: string; value: number; unit?: string; sub: string;
  change: string; up: boolean; neutral?: boolean;
  delay?: number;
  spark?: number[];
  accent?: StatAccent;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  /** Подпись метрики в tooltip'е sparkline'а. Если не задано, используем `label`. */
  sparkLabel?: string;
  /** Форматирует число в значение для tooltip'а (напр. `d` для дней). */
  sparkValueFormat?: (value: number) => string;
}) {
  // Sparkline-данные: [{ day: 'N d ago', v: count }]. Индекс
  // конвертируем в человекочитаемый offset «N дн. назад / сегодня /
  // вчера» — tooltip без этой подписи бессмысленен.
  const sparkData = useMemo(() => {
    const series = spark ?? [];
    const total = series.length;
    return series.map((v, i) => {
      const daysAgo = total - 1 - i;
      const day =
        daysAgo === 0 ? "today"
          : daysAgo === 1 ? "1d ago"
            : `${daysAgo}d ago`;
      return { day, v };
    });
  }, [spark]);
  const stroke = STAT_ACCENT_HEX[accent];
  const changeColor = neutral
    ? "text-[var(--muted)]"
    : up
      ? "text-emerald-500"
      : "text-red-500";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="group h-full overflow-hidden">
        <Card.Content className="flex h-full flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {Icon && (
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${STAT_ACCENT_BG[accent]}`}>
                  <Icon size={14} strokeWidth={1.8} />
                </span>
              )}
              <Text color="muted" className="m-0 truncate text-xs font-medium">{label}</Text>
            </div>
            <span className={`flex shrink-0 items-center gap-0.5 text-[11px] font-semibold ${changeColor}`}>
              {!neutral && (up
                ? <ArrowUpRight01Icon size={11} strokeWidth={2.5} />
                : <ArrowDownRight01Icon size={11} strokeWidth={2.5} />)}
              {change}
            </span>
          </div>
          <p className="m-0 text-3xl font-bold tabular-nums leading-none">
            <SlidingNumber value={value} />{unit}
          </p>
          <Text color="muted" className="m-0 text-[11px]">{sub}</Text>
          {sparkData.length >= 2 && (
            <RechartsAuto className="-mb-1 -mx-2 mt-auto h-12 min-h-[40px] w-[calc(100%+1rem)]">
              <AreaChart data={sparkData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <RechartsTip
                  cursor={{ stroke, strokeOpacity: 0.4, strokeWidth: 1 }}
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(label) => String(label)}
                  formatter={(value) => {
                    const n = Number(value);
                    return [
                      sparkValueFormat ? sparkValueFormat(n) : n,
                      sparkLabel ?? label,
                    ] as [string | number, string];
                  }}
                  wrapperStyle={{ outline: "none" }}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={stroke}
                  strokeWidth={1.8}
                  fill={stroke}
                  fillOpacity={0.16}
                  dot={false}
                  activeDot={{ r: 3, stroke, strokeWidth: 2, fill: "var(--surface)" }}
                  isAnimationActive
                />
                <XAxis dataKey="day" hide />
              </AreaChart>
            </RechartsAuto>
          )}
        </Card.Content>
      </Card>
    </motion.div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      // outline-none + focus-visible:ring — клик не оставляет белый
      // дефолт-фокус от браузера, но Tab-навигация с клавиатуры всё ещё
      // подсвечивает кнопку accent-ring'ом.
      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        active
          ? "bg-accent/10 text-accent"
          : "text-[var(--muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
      }`}
    >
      {label}
    </button>
  );
}

function FunnelBar({ label, value, max, color, conv, convLabel }:
  { label: string; value: number; max: number; color: string; conv?: string; convLabel: string }
) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
        <span className="font-medium">{label}</span>
        <div className="flex items-center gap-2 sm:gap-3">
          {conv && <span className="text-[var(--muted)]">{convLabel} {conv}</span>}
          <span className="font-bold tabular-nums">{value}</span>
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
        />
      </div>
    </div>
  );
}

/** Превью команды в обзоре — список в стиле остальных Card приложения */
function OverviewTeamSpotlight({
  members,
  title,
  subtitle,
  doneLabel,
  ptsLabel,
}: {
  members: TeamMemberRow[];
  title: string;
  subtitle: string;
  doneLabel: string;
  ptsLabel: string;
}) {
  const sorted = [...members].sort((a, b) => b.pts - a.pts).slice(0, 4);

  return (
    <Card className="min-w-0">
      <Card.Header>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--muted)]">
            <UserGroupIcon size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <Card.Title className="text-base">{title}</Card.Title>
            <Card.Description>{subtitle}</Card.Description>
          </div>
        </div>
      </Card.Header>
      <Card.Content className="p-0">
        <ul className="divide-y divide-[var(--border)]">
          {sorted.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-xs font-semibold text-[var(--foreground)]">
                {m.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-sm font-medium leading-tight">{m.name}</p>
                <Text color="muted" className="m-0 truncate text-xs">{m.role}</Text>
              </div>
              <div className="shrink-0 text-right">
                <p className="m-0 text-sm font-semibold tabular-nums leading-none">
                  {m.pts}
                  <span className="ml-1 text-[10px] font-normal text-[var(--muted)]">{ptsLabel}</span>
                </p>
                <p className="m-0 mt-1 text-xs tabular-nums text-[var(--muted)]">
                  <span className="font-medium text-[var(--foreground)]">{m.done}</span>
                  {" · "}
                  {doneLabel}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card.Content>
    </Card>
  );
}

/** Воронка: одна шкала от входа (128), ширина полосы = доля от первой стадии — наглядно и без лишнего */
function OverviewFlowPipeline({
  stages,
  labels,
  convLabel,
  cycleLabel,
  doneLabel,
  flowSummary,
  title,
  subtitle,
}: {
  stages: FlowStageRow[];
  labels: string[];
  convLabel: string;
  cycleLabel: string;
  doneLabel: string;
  flowSummary: { conv: string; cycle: string; completed: string };
  title: string;
  subtitle: string;
}) {
  const funnelTop = stages[0]?.value ?? 1;

  return (
    <Card className="min-w-0">
      <Card.Header>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--muted)]">
            <FlowIcon size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <Card.Title className="text-base">{title}</Card.Title>
            <Card.Description>{subtitle}</Card.Description>
          </div>
        </div>
      </Card.Header>
      <Card.Content className="space-y-5 px-4 pb-5 pt-0">
        <div className="space-y-4">
          {stages.map((row, idx) => {
            const widthPct = Math.min(100, (row.value / funnelTop) * 100);
            const ofTotalPct = Math.round((row.value / row.max) * 100);
            const next = stages[idx + 1];
            const handoffPct =
              next && row.value > 0 ? Math.round((next.value / row.value) * 100) : null;

            return (
              <div key={labels[idx]} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Text color="muted" className="m-0 min-w-0 flex-1 text-xs font-medium leading-snug">
                    {labels[idx]}
                  </Text>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-semibold tabular-nums">{row.value}</span>
                    <span className="ml-1.5 text-[11px] tabular-nums text-[var(--muted)]">
                      ({ofTotalPct}%)
                    </span>
                  </div>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: row.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 24 }}
                  />
                </div>
                {handoffPct != null && (
                  <p className="m-0 text-[11px] leading-snug text-[var(--muted)]">
                    → {labels[idx + 1]}:{" "}
                    <span className="font-medium tabular-nums text-[var(--foreground)]">{handoffPct}%</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-3">
          {[
            { v: flowSummary.conv, l: convLabel },
            { v: flowSummary.cycle, l: cycleLabel },
            { v: flowSummary.completed, l: doneLabel },
          ].map(({ v, l }) => (
            <div key={l} className="text-center sm:text-left">
              <p className="m-0 text-lg font-semibold tabular-nums">{v}</p>
              <Text color="muted" className="m-0 text-[11px]">{l}</Text>
            </div>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}

type Tab4 = "overview" | "sprints" | "team" | "flow";

export function AnalyticsPage() {
  const { t } = useI18n();
  const ins = t.insights;
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspaceShell();
  const [tasks, setTasks] = useState<TaskPayload[]>([]);
  const [activeTab, setActiveTab] = useState<Tab4>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isNarrow = useMediaQuery("(max-width: 639px)");
  const isCompact = useMediaQuery("(max-width: 1023px)");
  const labels = useLabelResolver(activeWorkspaceId);

  /**
   * Загрузка задач. `loading` — initial fetch (показываем skeleton),
   * `refreshing` — повторный (показываем спиннер на кнопке). Оба
   * флага помогают не моргать UI при пустом ответе.
   */
  const fetchTasks = useCallback(async (mode: "initial" | "refresh") => {
    if (!activeWorkspaceId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    try {
      const list = await api.getTasks(activeWorkspaceId);
      setTasks(list);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    // fetchTasks setState'ит loading/refreshing внутри async-цикла; правило
    // `react-hooks/set-state-in-effect` про async-fetch не догадывается.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTasks("initial").catch(() => undefined);
  }, [fetchTasks]);

  const handleRefresh = useCallback(() => {
    void fetchTasks("refresh");
  }, [fetchTasks]);

  const now = useMemo(() => new Date(), []);
  const currentWeekStart = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);
  const previousWeekStart = useMemo(() => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    return d;
  }, [currentWeekStart]);
  const currentWeekEnd = useMemo(() => {
    const d = new Date(now);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [now]);

  const analyticsData = useMemo(() => {
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((task) => isDoneStatus(task.status));
    const inProgressTasks = tasks.filter((task) => isInProgressStatus(task.status));
    const reviewTasks = tasks.filter((task) => isReviewStatus(task.status));
    const completedThisWeek = countBetween(tasks, currentWeekStart, currentWeekEnd, (task) => safeDate(task.completedAt));
    const completedPreviousWeek = countBetween(tasks, previousWeekStart, currentWeekStart, (task) => safeDate(task.completedAt));
    const createdThisWeek = countBetween(tasks, currentWeekStart, currentWeekEnd, (task) => safeDate(task.createdAt));
    const createdPreviousWeek = countBetween(tasks, previousWeekStart, currentWeekStart, (task) => safeDate(task.createdAt));
    const overdue = tasks.filter((task) => {
      const due = safeDate(task.dueDate);
      return due && due < now && !isDoneStatus(task.status);
    }).length;
    const bugCount = tasks.filter((task) => {
      const text = `${task.taskType ?? ""} ${task.labels.join(" ")} ${task.title}`.toLowerCase();
      return text.includes("bug") || text.includes("defect");
    }).length;
    /**
     * Cycle time WoW: считаем avg-cycle отдельно для задач,
     * завершённых на текущей и предыдущей неделе, чтобы выдать
     * корректный `cycleChange` (раньше всегда «0%»).
     */
    const cycleSamples = (range: { from: Date; to: Date }) =>
      tasks
        .map((task) => {
          const created = safeDate(task.createdAt);
          const completed = safeDate(task.completedAt);
          if (!created || !completed) return null;
          if (completed < range.from || completed >= range.to) return null;
          return Math.max(0, completed.getTime() - created.getTime());
        })
        .filter((value): value is number => value != null);
    const cycleAvgDays = (samples: number[]) =>
      samples.length
        ? Math.round((samples.reduce((sum, v) => sum + v, 0) / samples.length / 86_400_000) * 10) / 10
        : 0;
    const cycleDaysThisWeek = cycleAvgDays(cycleSamples({ from: currentWeekStart, to: currentWeekEnd }));
    const cycleDaysPrevWeek = cycleAvgDays(cycleSamples({ from: previousWeekStart, to: currentWeekStart }));
    // Для верхней карточки берём avg по всем завершённым (стабильнее),
    // но WoW считаем именно по двум неделям выше.
    const completedWithDates = doneTasks
      .map((task) => {
        const created = safeDate(task.createdAt);
        const completed = safeDate(task.completedAt);
        return created && completed ? Math.max(0, completed.getTime() - created.getTime()) : null;
      })
      .filter((value): value is number => value != null);
    const cycleDays = completedWithDates.length
      ? Math.max(1, Math.round(completedWithDates.reduce((sum, value) => sum + value, 0) / completedWithDates.length / 86_400_000))
      : 0;
    // Для cycle: «вверх» = плохо (рост времени), «вниз» = хорошо.
    // Поэтому передаём `up` инвертированно при использовании.
    const cycleDeltaDays = cycleDaysThisWeek - cycleDaysPrevWeek;
    const cycleChangeStr =
      cycleDaysPrevWeek === 0
        ? cycleDaysThisWeek > 0 ? `${cycleDaysThisWeek}d` : "—"
        : `${cycleDeltaDays > 0 ? "+" : ""}${Math.round((cycleDeltaDays / Math.max(0.1, cycleDaysPrevWeek)) * 100)}%`;
    /**
     * Распределение задач по реальным статусам — заменяет старые
     * heuristic-категории (dev/design/testing/planning), которые
     * угадывались по словам в заголовке и почти всегда давали 100% dev.
     * Используем 4 универсальных стейджа: todo / in progress / review / done.
     *
     * Для todo-бакета берём отдельный лейбл `stageTodo` («В очереди»),
     * чтобы не конфликтовать с funnel-стадией «Создано» (которая означает
     * совсем другое — кумулятивный счёт всех задач за период).
     */
    const todoCount = totalTasks - doneTasks.length - inProgressTasks.length - reviewTasks.length;
    const statusCounts = [
      { name: ins.stageTodo, value: Math.max(0, todoCount) },
      { name: ins.stageInProgress, value: inProgressTasks.length },
      { name: ins.stageReview, value: reviewTasks.length },
      { name: ins.stageDone, value: doneTasks.length },
    ];
    const statusTotal = statusCounts.reduce((sum, s) => sum + s.value, 0) || 1;
    const categoryData = statusCounts.map((s) => ({
      name: s.name,
      value: Math.round((s.value / statusTotal) * 100),
      count: s.value,
    }));
    const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + index);
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      return {
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        tasks: countBetween(tasks, date, next, (task) => safeDate(task.completedAt)),
        hours: countBetween(tasks, date, next, (task) => safeDate(task.completedAt)) * 0.5,
      };
    });
    const monthlyTrend = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      return {
        month: date.toLocaleDateString("en-US", { month: "short" }),
        completed: countBetween(tasks, date, next, (task) => safeDate(task.completedAt)),
        created: countBetween(tasks, date, next, (task) => safeDate(task.createdAt)),
      };
    });
    const sprintVelocity = Array.from({ length: 8 }, (_, index) => {
      const end = new Date(currentWeekEnd);
      end.setDate(currentWeekEnd.getDate() - (7 - index) * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return {
        sprint: `W${index + 1}`,
        planned: countBetween(tasks, start, end, (task) => safeDate(task.createdAt)),
        actual: countBetween(tasks, start, end, (task) => safeDate(task.completedAt)),
      };
    });
    const burndown = Array.from({ length: 8 }, (_, index) => {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + index);
      const ideal = Math.max(0, totalTasks - Math.round((totalTasks / 7) * index));
      const completedByDate = tasks.filter((task) => {
        const completed = safeDate(task.completedAt);
        return completed && completed <= date;
      }).length;
      return {
        day: `D${index + 1}`,
        remaining: Math.max(0, totalTasks - completedByDate),
        ideal,
      };
    });
    /**
     * Команда: считаем по реальным `assigneeIds` задач, исключая
     * неназначенные (раньше они показывались строкой «Unassigned»
     * с UUID-ишником, что выглядело как баг). Имя резолвим через
     * `labels.resolveUser` — он подтягивает workspace-мемберов и
     * возвращает displayName / email / шорт-UUID. Раньше тут был
     * лишний обёртку «User abc123», но resolver сам делает email
     * fetch для членов без displayName, так что строка либо имя,
     * либо email.
     */
    const memberMap = new Map<string, TeamMemberRow>();
    for (const task of tasks) {
      if (!task.assigneeIds.length) continue;
      for (const assigneeId of task.assigneeIds) {
        const displayName = labels.resolveUser(assigneeId);
        const row = memberMap.get(assigneeId) ?? {
          id: assigneeId,
          name: displayName,
          role: "Member",
          done: 0,
          inProgress: 0,
          pts: 0,
          focus: 0,
        };
        // Имя могло прийти позже (после `getUserById`), обновляем.
        row.name = displayName;
        if (isDoneStatus(task.status)) row.done++;
        if (isInProgressStatus(task.status)) row.inProgress++;
        row.pts += isDoneStatus(task.status) ? 3 : 1;
        row.focus += isInProgressStatus(task.status) ? 1 : 0;
        memberMap.set(assigneeId, row);
      }
    }
    const teamRows = [...memberMap.values()];
    const createdCount = totalTasks;
    const inProgressCount = inProgressTasks.length;
    const reviewCount = reviewTasks.length;
    const doneCount = doneTasks.length;
    /**
     * Кумулятивная воронка: на каждом шаге значение = задачи,
     * которые когда-либо достигли этой стадии (или дальше).
     *
     * Раньше тут был snapshot-подсчёт («В работе» = только
     * сейчас в работе), и это выглядело как фейк: при 1 задаче
     * в работе строка «В работе» показывала Конверсию 100%,
     * а «Ревью» — 0%, хотя задача физически не могла перепрыгнуть.
     *
     *   Created       = всего создано
     *   Started       = inProgress + review + done   («покинули todo»)
     *   ReachedReview = review + done                («дошли до ревью»)
     *   Completed     = done                         («завершены»)
     *
     * Conv % между шагами = реальная конверсия предыдущей стадии в
     * следующую, что и подразумевает заголовок «Конверсия этапов».
     */
    const startedCount = inProgressCount + reviewCount + doneCount;
    const reachedReviewCount = reviewCount + doneCount;
    const completedCount = doneCount;
    const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "0%");
    const funnelMax = Math.max(createdCount, 1);
    const flowStages: FlowStageRow[] = [
      { value: createdCount, max: funnelMax, color: "#94a3b8" },
      { value: startedCount, max: funnelMax, color: "#3b82f6", conv: pct(startedCount, createdCount) },
      { value: reachedReviewCount, max: funnelMax, color: "#f97316", conv: pct(reachedReviewCount, startedCount) },
      { value: completedCount, max: funnelMax, color: "#22c55e", conv: pct(completedCount, reachedReviewCount) },
    ];
    const sprintProgressPct = totalTasks ? Math.round((doneCount / totalTasks) * 100) : 0;
    const activeLoadCount = inProgressCount + reviewCount;
    /**
     * Sparkline-серии за последние 14 дней — для мини-графиков
     * в верхних карточках. Хранит только числовые точки,
     * чтобы StatCard сам строил [{x,v}] без знания формата.
     */
    const sparkDays = 14;
    const sparkCompleted: number[] = [];
    const sparkCreated: number[] = [];
    const sparkActive: number[] = [];
    const sparkCycle: number[] = [];
    for (let i = sparkDays - 1; i >= 0; i--) {
      const dayEnd = new Date(now);
      dayEnd.setDate(now.getDate() - i);
      dayEnd.setHours(23, 59, 59, 999);
      const dayStart = new Date(dayEnd);
      dayStart.setHours(0, 0, 0, 0);
      sparkCompleted.push(countBetween(tasks, dayStart, dayEnd, (task) => safeDate(task.completedAt)));
      sparkCreated.push(countBetween(tasks, dayStart, dayEnd, (task) => safeDate(task.createdAt)));
      // Активная загрузка как snapshot — задачи, созданные до конца дня
      // и ещё не завершённые до конца дня.
      const activeAtEnd = tasks.filter((task) => {
        const created = safeDate(task.createdAt);
        if (!created || created > dayEnd) return false;
        const completed = safeDate(task.completedAt);
        return !completed || completed > dayEnd;
      }).length;
      sparkActive.push(activeAtEnd);
      // Cycle-time за день: avg(дней) для задач, завершённых в этот день.
      const dayCompleted = tasks.filter((task) => {
        const completed = safeDate(task.completedAt);
        return completed && completed >= dayStart && completed <= dayEnd;
      });
      const dayCycles = dayCompleted
        .map((task) => {
          const created = safeDate(task.createdAt);
          const completed = safeDate(task.completedAt);
          return created && completed ? (completed.getTime() - created.getTime()) / 86_400_000 : null;
        })
        .filter((value): value is number => value != null);
      sparkCycle.push(
        dayCycles.length
          ? Math.round((dayCycles.reduce((sum, v) => sum + v, 0) / dayCycles.length) * 10) / 10
          : 0,
      );
    }
    return {
      velocityPts: completedThisWeek,
      velocityChange: pctChange(completedThisWeek, completedPreviousWeek),
      velocityFlat: completedThisWeek === completedPreviousWeek,
      cycleDays,
      cycleDaysThisWeek,
      cycleDaysPrevWeek,
      cycleChange: cycleChangeStr,
      cycleImproved: cycleDeltaDays <= 0,
      cycleFlat: cycleDeltaDays === 0,
      throughputTasks: createdThisWeek,
      throughputChange: pctChange(createdThisWeek, createdPreviousWeek),
      throughputFlat: createdThisWeek === createdPreviousWeek,
      bugRate: totalTasks ? Math.round((bugCount / totalTasks) * 100) : 0,
      overdue,
      activeLoadCount,
      activeLoadPct: totalTasks ? Math.round((activeLoadCount / totalTasks) * 100) : 0,
      sprintProgressPct,
      sprintCompleted: doneCount,
      sprintRemaining: Math.max(0, totalTasks - doneCount),
      totalTasks,
      categoryData,
      weeklyActivity,
      monthlyTrend,
      sprintVelocity,
      burndown,
      teamRows,
      flowStages,
      sparkCompleted,
      sparkCreated,
      sparkActive,
      sparkCycle,
      flowSummary: {
        conv: totalTasks ? `${sprintProgressPct}%` : "0%",
        cycle: cycleDays ? `${cycleDays}d` : "0d",
        completed: String(doneCount),
      },
    };
  }, [currentWeekEnd, currentWeekStart, now, previousWeekStart, tasks, labels, ins]);

  const catData = analyticsData.categoryData;

  /**
   * Computed insights — формируются ТОЛЬКО из реальных метрик.
   * Раньше тут были статичные строки «velocity +12% to last sprint»,
   * не зависящие от данных. Теперь же:
   *  - velocity card меняет цвет/направление по WoW дельте;
   *  - cycle card зелёный если время цикла улучшается;
   *  - overdue card красный если есть просрочки, зелёный если нет;
   *  - bug rate / load — в зависимости от порога.
   */
  const insightCards = useMemo(() => {
    type InsightTone = "emerald" | "red" | "amber" | "accent";
    const cards: { icon: string; tone: InsightTone; text: string }[] = [];
    const tonePalette: Record<InsightTone, string> = {
      emerald: "text-emerald-600 bg-emerald-500/10",
      red: "text-red-500 bg-red-500/10",
      amber: "text-amber-600 bg-amber-500/10",
      accent: "text-accent bg-accent/10",
    };
    // ── Velocity ──
    const velocityPct = Math.abs(parseInt(analyticsData.velocityChange.replace(/[^0-9-]/g, ""), 10) || 0);
    if (analyticsData.velocityFlat) {
      cards.push({ icon: "●", tone: "accent", text: ins.insightVelocityFlat });
    } else if (analyticsData.velocityPts >= 0 && analyticsData.velocityChange.startsWith("+")) {
      cards.push({ icon: "↑", tone: "emerald", text: ins.insightVelocityUp.replace("{pct}", String(velocityPct)) });
    } else {
      cards.push({ icon: "↓", tone: "red", text: ins.insightVelocityDown.replace("{pct}", String(velocityPct)) });
    }
    // ── Cycle time ──
    if (analyticsData.cycleDays === 0) {
      // Нет данных — пропускаем
    } else if (analyticsData.cycleDays <= 3) {
      cards.push({ icon: "⚡", tone: "emerald", text: ins.insightCycleFast.replace("{days}", String(analyticsData.cycleDays)) });
    } else {
      cards.push({ icon: "⏱", tone: "amber", text: ins.insightCycleSlow.replace("{days}", String(analyticsData.cycleDays)) });
    }
    // ── Overdue ──
    if (analyticsData.overdue > 0) {
      cards.push({ icon: "⚠", tone: "red", text: ins.insightOverdue.replace("{n}", String(analyticsData.overdue)) });
    } else if (analyticsData.totalTasks > 0) {
      cards.push({ icon: "✓", tone: "emerald", text: ins.insightNoOverdue });
    }
    // ── Bug rate ──
    if (analyticsData.bugRate >= 5) {
      cards.push({ icon: "🐞", tone: "red", text: ins.insightBug.replace("{pct}", String(analyticsData.bugRate)) });
    } else if (analyticsData.totalTasks > 0) {
      cards.push({ icon: "🛡", tone: "emerald", text: ins.insightBugLow });
    }
    // ── Workload ──
    if (analyticsData.activeLoadPct >= 60) {
      cards.push({ icon: "■", tone: "amber", text: ins.insightOverload.replace("{pct}", String(analyticsData.activeLoadPct)) });
    } else if (analyticsData.totalTasks > 0) {
      cards.push({ icon: "○", tone: "accent", text: ins.insightFlow.replace("{pct}", String(analyticsData.activeLoadPct)) });
    }
    return cards.slice(0, 4).map((c) => ({ icon: c.icon, color: tonePalette[c.tone], text: c.text }));
  }, [analyticsData, ins]);

  // Кумулятивные лейблы (Created / Started / Reached review / Completed)
  // — не путать с snapshot-метками pie-чарта (Todo / In Progress / Review /
  // Done). Здесь «Создано» = всего создано, «Начато» = вышли из todo и т.д.
  const flowStageLabels = [
    ins.stageCreated,
    ins.funnelStarted,
    ins.funnelReachedReview,
    ins.funnelCompleted,
  ];

  const monthlyTickInterval = isNarrow ? 2 : 0;

  return (
    <div className="space-y-6 py-4 sm:py-6">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
            <Analytics01Icon size={20} strokeWidth={1.8} className="text-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="m-0 text-xl font-bold tracking-tight sm:text-2xl">{ins.title}</h1>
            <Text color="muted" className="m-0 mt-0.5 text-sm">{ins.subtitle}</Text>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)]">
            {ins.range}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading || !activeWorkspaceId}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {refreshing
              ? <Loading03Icon size={13} className="animate-spin" />
              : <RefreshIcon size={13} strokeWidth={1.8} />}
            {refreshing ? ins.refreshing : ins.refresh}
          </button>
        </div>
      </motion.div>

      {/* ── No workspace ────────────────────────────────────────── */}
      {!activeWorkspaceId && (
        <Card>
          <Card.Content className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
              <Analytics01Icon size={28} strokeWidth={1.4} className="text-accent" />
            </div>
            <Text className="m-0 text-base font-semibold">{ins.emptyTitle}</Text>
            <Text color="muted" className="m-0 max-w-[420px] text-sm">{ins.emptyNoWorkspace}</Text>
          </Card.Content>
        </Card>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────── */}
      {loading && activeWorkspaceId && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <Card.Content className="flex flex-col gap-3 p-4">
                  <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--surface-secondary)]" />
                  <div className="h-8 w-3/4 animate-pulse rounded bg-[var(--surface-secondary)]" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--surface-secondary)]" />
                  <div className="mt-2 h-10 w-full animate-pulse rounded bg-[var(--surface-secondary)]" />
                </Card.Content>
              </Card>
            ))}
          </div>
          <Card>
            <Card.Content className="p-4">
              <div className="h-3 w-1/4 animate-pulse rounded bg-[var(--surface-secondary)]" />
              <div className="mt-3 h-2 w-full animate-pulse rounded bg-[var(--surface-secondary)]" />
            </Card.Content>
          </Card>
        </div>
      )}

      {/* ── Empty state (есть workspace, но 0 задач) ─────────────── */}
      {!loading && activeWorkspaceId && tasks.length === 0 && (
        <Card>
          <Card.Content className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
              <Idea01Icon size={28} strokeWidth={1.4} className="text-accent" />
            </div>
            <Text className="m-0 text-base font-semibold">{ins.emptyTitle}</Text>
            <Text color="muted" className="m-0 max-w-[460px] text-sm leading-relaxed">{ins.emptyBody}</Text>
            <button
              type="button"
              onClick={() => router.push("/projects")}
              className="mt-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground transition-[filter] hover:brightness-110"
            >
              {t.projects.title}
            </button>
          </Card.Content>
        </Card>
      )}

      {/* ── Data sections — рендерим только когда есть workspace и задачи ── */}
      {!loading && activeWorkspaceId && tasks.length > 0 && <>
      {/* Stat cards с sparklines.
       * Cycle: `up` инвертировано — рост cycleDays это плохо, поэтому
       * передаём `up={cycleImproved}` (зелёный при уменьшении).
       * Active load заменяет старый bugRate как productivity-метрика. */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard
          label={ins.velocity}
          value={analyticsData.velocityPts}
          unit=""
          sub={analyticsData.velocityFlat ? ins.sameAsLast7 : ins.last7Days}
          change={analyticsData.velocityChange}
          up={analyticsData.velocityChange.startsWith("+") || analyticsData.velocityPts > 0}
          neutral={analyticsData.velocityFlat}
          spark={analyticsData.sparkCompleted}
          sparkLabel={ins.completed}
          accent="emerald"
          icon={ArrowUpRight01Icon}
          delay={0.05}
        />
        <StatCard
          label={ins.cycleTime}
          value={analyticsData.cycleDays}
          unit="d"
          sub={ins.cycleTimeSub}
          change={analyticsData.cycleChange}
          up={analyticsData.cycleImproved}
          neutral={analyticsData.cycleFlat}
          spark={analyticsData.sparkCycle}
          sparkLabel={ins.cycleTime}
          sparkValueFormat={(v) => `${v}${ins.days[0] ?? "d"}`}
          accent="accent"
          icon={FlowIcon}
          delay={0.1}
        />
        <StatCard
          label={ins.throughput}
          value={analyticsData.throughputTasks}
          unit=""
          sub={ins.throughputSub}
          change={analyticsData.throughputChange}
          up={analyticsData.throughputChange.startsWith("+") || analyticsData.throughputTasks > 0}
          neutral={analyticsData.throughputFlat}
          spark={analyticsData.sparkCreated}
          sparkLabel={ins.created}
          accent="violet"
          icon={Idea01Icon}
          delay={0.15}
        />
        <StatCard
          label={ins.activeLoad}
          value={analyticsData.activeLoadCount}
          unit=""
          sub={ins.activeLoadSub}
          change={`${analyticsData.activeLoadPct}%`}
          up={analyticsData.activeLoadPct < 60}
          neutral={analyticsData.activeLoadCount === 0}
          spark={analyticsData.sparkActive}
          sparkLabel={ins.activeLoad}
          accent="amber"
          icon={UserGroupIcon}
          delay={0.2}
        />
      </div>

      {/* Workload progress — без хардкода «Sprint 14». Показывает
       * прогресс по всем задачам workspace + overdue inline.
       * Над progress-bar добавлена явная строка «X / Y completed»,
       * чтобы абсолютные числа были видны рядом с процентом. */}
      <Card>
        <Card.Content className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <Text color="muted" className="m-0 text-xs font-semibold uppercase tracking-wider">
                  {ins.workloadProgress}
                </Text>
                <span className="m-0 text-xs font-semibold tabular-nums text-[var(--foreground)]">
                  {analyticsData.sprintCompleted}
                  <span className="text-[var(--muted)]">{" / "}</span>
                  {analyticsData.totalTasks}
                  <span className="ml-1 text-[var(--muted)]">{ins.completed.toLowerCase()}</span>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="h-2 min-w-[120px] max-w-full flex-1 overflow-hidden rounded-full bg-[var(--surface-secondary)] sm:min-w-[200px]">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${analyticsData.sprintProgressPct}%` }}
                    transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.3 }}
                  />
                </div>
                <span className="text-sm font-bold tabular-nums">{analyticsData.sprintProgressPct}% {ins.workloadDone}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center sm:flex sm:gap-6 sm:text-left">
              {[
                { v: analyticsData.sprintCompleted, l: ins.completed, color: "text-emerald-600" },
                { v: analyticsData.sprintRemaining, l: ins.remaining, color: "" },
                { v: analyticsData.overdue, l: ins.overdueLabel, color: analyticsData.overdue > 0 ? "text-red-500" : "" },
              ].map(({ v, l, color }) => (
                <div key={l}>
                  <p className={`m-0 text-lg font-bold tabular-nums sm:text-xl ${color}`}>{v}</p>
                  <Text color="muted" className="m-0 text-[11px]">{l}</Text>
                </div>
              ))}
            </div>
          </div>
        </Card.Content>
      </Card>

      <div className="flex flex-wrap gap-1.5 border-b border-[var(--border)]/60 pb-3">
        {([
          ["overview", ins.tabOverview],
          ["sprints",  ins.tabSprints],
          ["team",     ins.tabTeam],
          ["flow",     ins.tabFlow],
        ] as [Tab4, string][]).map(([id, label]) => (
          <Tab key={id} label={label} active={activeTab === id} onClick={() => setActiveTab(id)} />
        ))}
      </div>

      {activeTab === "overview" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
          className="space-y-4">
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,1.2fr)]">
            <Card className="min-w-0 lg:min-w-0">
              <Card.Header>
                <Card.Title>{ins.weeklyActivity}</Card.Title>
                <Card.Description>{ins.weeklyActivitySub}</Card.Description>
              </Card.Header>
              <Card.Content className="px-2 pb-4 pt-0">
                <RechartsAuto className="h-[200px] w-full min-w-0 sm:h-[240px] md:h-[260px]">
                  <ComposedChart data={analyticsData.weeklyActivity} margin={{ top: 8, right: isNarrow ? 4 : 8, left: isNarrow ? -8 : 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTasks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: isNarrow ? 10 : 11 }} stroke="var(--muted)" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="var(--muted)" tickLine={false} axisLine={false} width={isNarrow ? 28 : 36} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="var(--muted)" tickLine={false} axisLine={false} width={isNarrow ? 28 : 36} />
                    <RechartsTip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                    <Area yAxisId="left" type="monotone" dataKey="tasks" name={ins.tasks} stroke="#3b82f6" strokeWidth={2} fill="url(#gradTasks)" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="hours" name={ins.hours} stroke="#a855f7" strokeWidth={2} dot={{ r: 2 }} />
                  </ComposedChart>
                </RechartsAuto>
              </Card.Content>
            </Card>

            <Card className="min-w-0 overflow-visible">
              <Card.Header>
                <Card.Title>{ins.statusDistribution}</Card.Title>
                <Card.Description>{ins.statusDistributionSub}</Card.Description>
              </Card.Header>
              <Card.Content className="overflow-visible px-2 pb-4 pt-0 sm:px-4">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-6">
                  <div className="mx-auto aspect-square w-full max-w-[min(100%,280px)] shrink-0 lg:mx-0 lg:w-[min(100%,300px)]">
                    <RechartsAuto className="h-full min-h-[220px] w-full min-w-0 sm:min-h-[240px]">
                      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <Pie
                          data={catData}
                          cx="50%"
                          cy="50%"
                          innerRadius="52%"
                          outerRadius="78%"
                          dataKey="value"
                          strokeWidth={2}
                          stroke="var(--surface)"
                          paddingAngle={2}
                        >
                          {catData.map((_, i) => (
                            <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTip contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </RechartsAuto>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                      {catData.map((item, i) => (
                        <div
                          key={item.name}
                          className="flex items-stretch gap-0 border-b border-[var(--border)]/80 last:border-b-0"
                        >
                          <div
                            className="w-1 shrink-0"
                            style={{ backgroundColor: CAT_COLORS[i] }}
                            aria-hidden
                          />
                          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:py-2">
                            <p className="m-0 min-w-0 flex-1 text-sm font-medium leading-snug text-[var(--foreground)]">
                              {item.name}
                            </p>
                            <div className="flex items-center gap-3 sm:contents">
                              <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-tertiary)] sm:hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${item.value}%`, backgroundColor: CAT_COLORS[i] }}
                                />
                              </div>
                              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)] sm:order-none">
                                {item.value}%
                              </span>
                            </div>
                          </div>
                          <div className="hidden w-28 shrink-0 items-center border-l border-[var(--border)]/60 bg-[var(--surface-secondary)]/40 px-3 sm:flex">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-tertiary)]">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${item.value}%`, backgroundColor: CAT_COLORS[i] }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card.Content>
            </Card>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
            <OverviewTeamSpotlight
              members={analyticsData.teamRows}
              title={ins.tabTeam}
              subtitle={ins.teamPerfSub}
              doneLabel={ins.tasksDone}
              ptsLabel={ins.totalPts}
            />
            <OverviewFlowPipeline
              stages={analyticsData.flowStages}
              labels={flowStageLabels}
              convLabel={ins.convRate}
              cycleLabel={ins.cycleTime}
              doneLabel={ins.completed}
              flowSummary={analyticsData.flowSummary}
              title={ins.tabFlow}
              subtitle={ins.flowSub}
            />
          </div>

          <Card className="min-w-0">
            <Card.Header>
              <Card.Title>{ins.monthlyTrend}</Card.Title>
              <Card.Description>{ins.monthlyTrendSub}</Card.Description>
            </Card.Header>
            <Card.Content className="px-2 pb-4 pt-0">
              <RechartsAuto className="h-[220px] w-full min-w-0 sm:h-[240px] lg:h-[260px]">
                <BarChart data={analyticsData.monthlyTrend} barGap={isCompact ? 1 : 2} margin={{ bottom: isNarrow ? 24 : 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: isNarrow ? 9 : 11 }}
                    stroke="var(--muted)"
                    tickLine={false}
                    axisLine={false}
                    interval={monthlyTickInterval}
                    angle={isNarrow ? -40 : 0}
                    textAnchor={isNarrow ? "end" : "middle"}
                    height={isNarrow ? 48 : 32}
                  />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" tickLine={false} axisLine={false} width={isNarrow ? 28 : 36} />
                  <RechartsTip contentStyle={TOOLTIP_STYLE} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="completed" name={ins.completed} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="created" name={ins.created} fill="#8b5cf6" radius={[4, 4, 0, 0]} opacity={0.65} />
                </BarChart>
              </RechartsAuto>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <div className="flex items-center gap-2">
                <Card.Title>{ins.topInsights}</Card.Title>
                <Idea01Icon size={16} strokeWidth={1.8} className="text-amber-500" />
              </div>
            </Card.Header>
            <Card.Content className="px-4 pb-4 pt-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {insightCards.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--border)]/60 p-3.5">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base font-bold leading-none ${c.color}`}>
                      <span className="block leading-none">{c.icon}</span>
                    </span>
                    <Text color="muted" className="m-0 flex-1 text-sm leading-relaxed">{c.text}</Text>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>
        </motion.div>
      )}

      {activeTab === "sprints" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
          className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="min-w-0">
            <Card.Header>
              <Card.Title>{ins.sprintVelocity}</Card.Title>
              <Card.Description>{ins.sprintVelocitySub}</Card.Description>
            </Card.Header>
            <Card.Content className="px-2 pb-4 pt-0">
              <RechartsAuto className="h-[240px] w-full min-w-0 sm:h-[280px]">
                <BarChart data={analyticsData.sprintVelocity} barGap={isCompact ? 2 : 4} margin={{ left: isNarrow ? 0 : 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="sprint" tick={{ fontSize: isNarrow ? 9 : 11 }} stroke="var(--muted)" tickLine={false} axisLine={false} interval={isNarrow ? 1 : 0} />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" tickLine={false} axisLine={false} width={32} />
                  <RechartsTip contentStyle={TOOLTIP_STYLE} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="planned" name={ins.planned} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name={ins.actual} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </RechartsAuto>
            </Card.Content>
          </Card>

          <Card className="min-w-0">
            <Card.Header>
              <Card.Title>{ins.burndown}</Card.Title>
              <Card.Description>{ins.burndownSub}</Card.Description>
            </Card.Header>
            <Card.Content className="px-2 pb-4 pt-0">
              <RechartsAuto className="h-[240px] w-full min-w-0 sm:h-[280px]">
                <LineChart data={analyticsData.burndown} margin={{ left: isNarrow ? 0 : 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="var(--muted)" tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" tickLine={false} axisLine={false} width={32} />
                  <RechartsTip contentStyle={TOOLTIP_STYLE} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Line dataKey="remaining" name={ins.remaining} stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                  <Line dataKey="ideal" name={ins.ideal} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                </LineChart>
              </RechartsAuto>
            </Card.Content>
          </Card>
        </motion.div>
      )}

      {activeTab === "team" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-4">
          <Card className="hidden md:block">
            <Card.Header>
              <Card.Title>{ins.teamPerf}</Card.Title>
              <Card.Description>{ins.teamPerfSub}</Card.Description>
            </Card.Header>
            <Card.Content className="px-0 pb-0 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]/60">
                      {[ins.member, ins.tasksDone, ins.inProgress, ins.totalPts].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/40">
                    {analyticsData.teamRows.map((member, i) => (
                      <tr key={member.id} className="transition-colors hover:bg-[var(--surface-secondary)]/30">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                            >
                              {member.name[0]}
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium">{member.name}</span>
                              <Text color="muted" className="m-0 block truncate text-[11px]">{member.role}</Text>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge size="sm" color="success" variant="soft">{member.done}</Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge size="sm" color="accent" variant="soft">{member.inProgress}</Badge>
                        </td>
                        <td className="px-5 py-3.5 font-bold tabular-nums">{member.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card.Content>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
            {analyticsData.teamRows.map((member, i) => (
              <Card key={member.id}>
                <Card.Content className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                    >
                      {member.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 font-semibold leading-tight">{member.name}</p>
                      <Text color="muted" className="m-0 text-xs">{member.role}</Text>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="m-0 text-lg font-bold tabular-nums">{member.done}</p>
                          <Text color="muted" className="m-0 text-[10px] uppercase">{ins.tasksDone}</Text>
                        </div>
                        <div>
                          <p className="m-0 text-lg font-bold tabular-nums">{member.inProgress}</p>
                          <Text color="muted" className="m-0 text-[10px] uppercase">{ins.inProgress}</Text>
                        </div>
                        <div>
                          <p className="m-0 text-lg font-bold tabular-nums">{member.pts}</p>
                          <Text color="muted" className="m-0 text-[10px] uppercase">{ins.totalPts}</Text>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === "flow" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <Card>
            <Card.Header>
              <Card.Title>{ins.flowTitle}</Card.Title>
              <Card.Description>{ins.flowSub}</Card.Description>
            </Card.Header>
            <Card.Content className="px-4 pb-6 pt-0 sm:px-6">
              <div className="space-y-5">
                {analyticsData.flowStages.map((row, idx) => (
                  <FunnelBar
                    key={flowStageLabels[idx]}
                    label={flowStageLabels[idx]}
                    value={row.value}
                    max={row.max}
                    color={row.color}
                    conv={row.conv}
                    convLabel={ins.convRate}
                  />
                ))}
                <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--surface-secondary)]/30 p-4">
                  <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
                    {[
                      { v: analyticsData.flowSummary.conv, l: ins.convRate },
                      { v: analyticsData.flowSummary.cycle, l: ins.cycleTime },
                      { v: analyticsData.flowSummary.completed, l: ins.completed },
                    ].map(({ v, l }) => (
                      <div key={l}>
                        <p className="m-0 text-xl font-bold">{v}</p>
                        <Text color="muted" className="m-0 text-[11px]">{l}</Text>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>
        </motion.div>
      )}
      </>}
    </div>
  );
}
