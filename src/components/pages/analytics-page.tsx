"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card, Text } from "@heroui/react";
import {
  ArrowUpRight01Icon,
  ArrowDownRight01Icon,
  Analytics01Icon,
  Idea01Icon,
  UserGroupIcon,
  FlowIcon,
} from "hugeicons-react";
import {
  Area, XAxis, YAxis, CartesianGrid,
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

function isDoneStatus(status: string) {
  const s = status?.toLowerCase() ?? "";
  return s === "done" || s === "completed" || s === "closed";
}

function isInProgressStatus(status: string) {
  const s = status?.toLowerCase() ?? "";
  return s === "in_progress" || s === "active" || s === "in-progress";
}

function isReviewStatus(status: string) {
  const s = status?.toLowerCase() ?? "";
  return s === "review" || s === "in_review" || s === "in-review";
}

function safeDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function categoryKey(task: TaskPayload) {
  const text = `${task.taskType ?? ""} ${task.labels.join(" ")} ${task.title}`.toLowerCase();
  if (text.includes("design") || text.includes("ui") || text.includes("ux")) return "design";
  if (text.includes("test") || text.includes("qa") || text.includes("bug")) return "testing";
  if (text.includes("plan") || text.includes("doc") || text.includes("spec")) return "planning";
  return "dev";
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

function StatCard({
  label, value, unit, sub, change, up, delay = 0,
}: {
  label: string; value: number; unit?: string; sub: string;
  change: string; up: boolean; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="h-full">
        <Card.Content className="flex flex-col gap-2 p-4">
          <Text variant="muted" className="m-0 text-xs">{label}</Text>
          <div className="flex items-end gap-2">
            <p className="m-0 text-2xl font-bold tabular-nums leading-none">
              <SlidingNumber value={value} />{unit}
            </p>
            <span className={`mb-0.5 flex items-center gap-0.5 text-xs font-semibold ${up ? "text-emerald-500" : "text-red-500"}`}>
              {up
                ? <ArrowUpRight01Icon size={12} strokeWidth={2.5} />
                : <ArrowDownRight01Icon size={12} strokeWidth={2.5} />}
              {change}
            </span>
          </div>
          <Text variant="muted" className="m-0 text-[11px]">{sub}</Text>
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
      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
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
                <Text variant="muted" className="m-0 truncate text-xs">{m.role}</Text>
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
                  <Text variant="muted" className="m-0 min-w-0 flex-1 text-xs font-medium leading-snug">
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
              <Text variant="muted" className="m-0 text-[11px]">{l}</Text>
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
  const { activeWorkspaceId } = useWorkspaceShell();
  const [tasks, setTasks] = useState<TaskPayload[]>([]);
  const [activeTab, setActiveTab] = useState<Tab4>("overview");
  const isNarrow = useMediaQuery("(max-width: 639px)");
  const isCompact = useMediaQuery("(max-width: 1023px)");

  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    api.getTasks(activeWorkspaceId)
      .then((list) => {
        if (!cancelled) setTasks(list);
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      });
    return () => { cancelled = true; };
  }, [activeWorkspaceId]);

  const catLabels = useMemo(
    () => [ins.catDev, ins.catDesign, ins.catTesting, ins.catPlanning] as const,
    [ins.catDev, ins.catDesign, ins.catTesting, ins.catPlanning],
  );
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
    const categoryCounts = { dev: 0, design: 0, testing: 0, planning: 0 };
    for (const task of tasks) categoryCounts[categoryKey(task)]++;
    const catTotal = Object.values(categoryCounts).reduce((sum, value) => sum + value, 0) || 1;
    const categoryData = (["dev", "design", "testing", "planning"] as const).map((key, index) => ({
      name: catLabels[index],
      value: Math.round((categoryCounts[key] / catTotal) * 100),
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
    const memberMap = new Map<string, TeamMemberRow>();
    for (const task of tasks) {
      const assignees = task.assigneeIds.length ? task.assigneeIds : ["unassigned"];
      for (const assigneeId of assignees) {
        const row = memberMap.get(assigneeId) ?? {
          id: assigneeId,
          name: assigneeId === "unassigned" ? "Unassigned" : `User ${assigneeId.slice(0, 6)}`,
          role: "Member",
          done: 0,
          inProgress: 0,
          pts: 0,
          focus: 0,
        };
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
    const flowStages: FlowStageRow[] = [
      { value: createdCount, max: Math.max(createdCount, 1), color: "#94a3b8" },
      { value: inProgressCount, max: Math.max(createdCount, 1), color: "#3b82f6", conv: createdCount ? `${Math.round((inProgressCount / createdCount) * 100)}%` : "0%" },
      { value: reviewCount, max: Math.max(createdCount, 1), color: "#f97316", conv: inProgressCount ? `${Math.round((reviewCount / inProgressCount) * 100)}%` : "0%" },
      { value: doneCount, max: Math.max(createdCount, 1), color: "#22c55e", conv: reviewCount ? `${Math.round((doneCount / reviewCount) * 100)}%` : "0%" },
    ];
    const sprintProgressPct = totalTasks ? Math.round((doneCount / totalTasks) * 100) : 0;
    return {
      velocityPts: completedThisWeek,
      velocityChange: pctChange(completedThisWeek, completedPreviousWeek),
      cycleDays,
      cycleChange: cycleDays > 0 ? "0%" : "0%",
      throughputTasks: completedThisWeek,
      throughputChange: pctChange(createdThisWeek, createdPreviousWeek),
      bugRate: totalTasks ? Math.round((bugCount / totalTasks) * 100) : 0,
      overdue,
      sprintProgressPct,
      sprintCompleted: doneCount,
      sprintRemaining: Math.max(0, totalTasks - doneCount),
      sprintDaysLeft: overdue,
      categoryData,
      weeklyActivity,
      monthlyTrend,
      sprintVelocity,
      burndown,
      teamRows,
      flowStages,
      flowSummary: {
        conv: totalTasks ? `${sprintProgressPct}%` : "0%",
        cycle: cycleDays ? `${cycleDays}d` : "0d",
        completed: String(doneCount),
      },
    };
  }, [catLabels, currentWeekEnd, currentWeekStart, now, previousWeekStart, tasks]);

  const catData = analyticsData.categoryData;

  const insightCards = [
    { icon: "↑", color: "text-emerald-500 bg-emerald-500/10", text: ins.insightVelocity },
    { icon: "⚠", color: "text-red-500 bg-red-500/10",         text: ins.insightBug },
    { icon: "↓", color: "text-accent bg-accent/10",            text: ins.insightCycle },
    { icon: "●", color: "text-amber-500 bg-amber-500/10",      text: ins.insightFocus },
  ];

  const flowStageLabels = [ins.stageCreated, ins.stageInProgress, ins.stageReview, ins.stageDone];

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
            <Text variant="muted" className="m-0 mt-0.5 text-sm">{ins.subtitle}</Text>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)]">
            {ins.range}
          </span>
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-secondary)]"
          >
            {ins.export}
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard label={ins.velocity}   value={analyticsData.velocityPts} unit=" pts" sub={ins.velocitySub}   change={analyticsData.velocityChange} up delay={0.05} />
        <StatCard label={ins.cycleTime}  value={analyticsData.cycleDays} unit=" d"  sub={ins.cycleTimeSub}  change={analyticsData.cycleChange}  up delay={0.1}  />
        <StatCard label={ins.throughput} value={analyticsData.throughputTasks}           sub={ins.throughputSub}  change={analyticsData.throughputChange}  up delay={0.15} />
        <StatCard label={ins.bugRate}    value={analyticsData.bugRate} unit="%" sub={ins.bugRateSub}     change={`${analyticsData.overdue}`} up={analyticsData.overdue === 0} delay={0.2} />
      </div>

      <Card>
        <Card.Content className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <Text variant="muted" className="m-0 text-xs font-semibold uppercase tracking-wider">
                {ins.sprintProgress} — Sprint 14
              </Text>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="h-2 min-w-[120px] max-w-full flex-1 overflow-hidden rounded-full bg-[var(--surface-secondary)] sm:min-w-[200px]">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${analyticsData.sprintProgressPct}%` }}
                    transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.3 }}
                  />
                </div>
                <span className="text-sm font-bold">{analyticsData.sprintProgressPct}% {ins.sprintDone}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center sm:flex sm:gap-6 sm:text-left">
              {[
                { v: analyticsData.sprintCompleted, l: ins.completed },
                { v: analyticsData.sprintRemaining, l: ins.remaining },
                { v: analyticsData.sprintDaysLeft,  l: ins.daysLeft  },
              ].map(({ v, l }) => (
                <div key={l}>
                  <p className="m-0 text-lg font-bold tabular-nums sm:text-xl">{v}</p>
                  <Text variant="muted" className="m-0 text-[11px]">{l}</Text>
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
                <Card.Title>{ins.categories}</Card.Title>
                <Card.Description>{ins.categoriesSub}</Card.Description>
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
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-[var(--border)]/60 p-3.5">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${c.color}`}>
                      {c.icon}
                    </span>
                    <Text variant="muted" className="m-0 text-sm leading-relaxed">{c.text}</Text>
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
                              <Text variant="muted" className="m-0 block truncate text-[11px]">{member.role}</Text>
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
                      <Text variant="muted" className="m-0 text-xs">{member.role}</Text>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="m-0 text-lg font-bold tabular-nums">{member.done}</p>
                          <Text variant="muted" className="m-0 text-[10px] uppercase">{ins.tasksDone}</Text>
                        </div>
                        <div>
                          <p className="m-0 text-lg font-bold tabular-nums">{member.inProgress}</p>
                          <Text variant="muted" className="m-0 text-[10px] uppercase">{ins.inProgress}</Text>
                        </div>
                        <div>
                          <p className="m-0 text-lg font-bold tabular-nums">{member.pts}</p>
                          <Text variant="muted" className="m-0 text-[10px] uppercase">{ins.totalPts}</Text>
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
                        <Text variant="muted" className="m-0 text-[11px]">{l}</Text>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
