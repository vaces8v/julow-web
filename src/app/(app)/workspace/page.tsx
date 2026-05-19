"use client";

import {
  Button,
  Card,
  Chip,
  Input,
  Text,
  Badge,
} from "@heroui/react";
import {
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  Task01Icon,
  AlertCircleIcon,
  ArrowRight01Icon,
  GridViewIcon,
  Menu01Icon,
  UserAdd01Icon,
} from "hugeicons-react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useCallback, useEffect, useMemo, useState, ViewTransition } from "react";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { Fade } from "@/components/ui/fade";
import { useI18n } from "@/i18n/context";
import {
  api,
  AnalyticsPayload,
  TaskPayload,
} from "@/lib/api";

type ViewMode = "board" | "list";

/** Безопасно парсит ISO-дату из бэкенда; возвращает `null`, если строки нет
 *  или дата невалидная. */
function safeDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Формирует ряд из 7 дней (от 6 дней назад до сегодня) для recharts.
 *  По каждому дню считаем число задач, созданных и завершённых в этот день
 *  на основании `createdAt`/`completedAt` из `getTasks`. */
function buildWeeklySeries(tasks: TaskPayload[]): { day: string; created: number; completed: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - 6);

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const next = new Date(date);
    next.setDate(date.getDate() + 1);

    let created = 0;
    let completed = 0;
    for (const task of tasks) {
      const c = safeDate(task.createdAt);
      if (c && c >= date && c < next) created++;
      const d = safeDate(task.completedAt);
      if (d && d >= date && d < next) completed++;
    }
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      created,
      completed,
    };
  });
}

/**
 * «N мин назад / N ч назад / N дн назад / только что» — относительное время
 * для активити-фида. Подставляет `{n}` в i18n-шаблон.
 */
function formatRelativeTime(
  iso: string | undefined,
  labels: { timeNow: string; timeMinutes: string; timeHours: string; timeDays: string },
): string {
  const date = safeDate(iso);
  if (!date) return "";
  const diffSec = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return labels.timeNow;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return labels.timeMinutes.replace("{n}", String(diffMin));
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return labels.timeHours.replace("{n}", String(diffHr));
  const diffDay = Math.floor(diffHr / 24);
  return labels.timeDays.replace("{n}", String(diffDay));
}

/**
 * Сборка ленты «recent task events» из массива задач.
 * Берём 5 последних событий (создание ИЛИ завершение задачи), сортируем по
 * времени убыванию. На каждое событие — одна строка в активити-фиде.
 */
type TaskEvent = {
  id: string;
  taskId: string;
  projectId?: string;
  taskTitle: string;
  kind: "created" | "completed";
  at: Date;
};

function buildRecentEvents(tasks: TaskPayload[], limit = 5): TaskEvent[] {
  const events: TaskEvent[] = [];
  for (const task of tasks) {
    const created = safeDate(task.createdAt);
    if (created) {
      events.push({
        id: `${task.id}:c`,
        taskId: task.id,
        projectId: task.projectId,
        taskTitle: task.title,
        kind: "created",
        at: created,
      });
    }
    const completed = safeDate(task.completedAt);
    if (completed) {
      events.push({
        id: `${task.id}:d`,
        taskId: task.id,
        projectId: task.projectId,
        taskTitle: task.title,
        kind: "completed",
        at: completed,
      });
    }
  }
  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  return events.slice(0, limit);
}

function priorityDot(priority: TaskPayload["priority"]) {
  const p = priority?.toLowerCase() ?? "";
  switch (p) {
    case "high":
    case "critical":
    case "urgent":
      return "bg-red-500";
    case "medium":
      return "bg-amber-500";
    case "low":
      return "bg-emerald-500";
    default:
      return "bg-gray-400";
  }
}

function statusLabel(status: TaskPayload["status"]) {
  const s = status?.toLowerCase() ?? "";
  switch (s) {
    case "todo":
    case "backlog":
      return "К выполнению";
    case "in_progress":
    case "active":
    case "in-progress":
      return "В работе";
    case "review":
    case "in_review":
    case "in-review":
      return "Ревью";
    case "done":
    case "completed":
    case "closed":
      return "Готово";
    default:
      return status;
  }
}

function statusColor(status: TaskPayload["status"]) {
  const s = status?.toLowerCase() ?? "";
  switch (s) {
    case "todo":
    case "backlog":
      return "default" as const;
    case "in_progress":
    case "active":
    case "in-progress":
      return "accent" as const;
    case "review":
    case "in_review":
    case "in-review":
      return "warning" as const;
    case "done":
    case "completed":
    case "closed":
      return "success" as const;
    default:
      return "default" as const;
  }
}

export default function Home() {
  // workspace-shell: `refreshAll` после join подтянет и workspaces, и
  // проекты cross-workspace (новый guest-workspace + проект сразу появятся
  // в табах). `activeWorkspaceId` определяет, какие задачи/аналитику грузить.
  // `allProjects` нужен для проброса имени проекта в карточки задач
  // (cross-workspace, чтобы корректно работать после join).
  const { activeWorkspaceId, allProjects, refreshAll } = useWorkspaceShell();
  const { t } = useI18n();
  const d = t.dashboard;
  const router = useRouter();

  /**
   * Открыть задачу. URL-паттерн `/projects/{projectId}?task={taskId}` —
   * тот же, что используется во всём приложении (см. `app-shell.tsx`
   * goToRelated / notification deep-link). Если у задачи нет projectId
   * (что в принципе невозможно из бэкенда, но защищаемся), просто
   * ничего не делаем.
   */
  const openTask = useCallback((task: { id: string; projectId?: string }) => {
    if (!task.projectId) return;
    router.push(`/projects/${task.projectId}?task=${task.id}`);
  }, [router]);
  /** Открыть проект целиком (доска проекта). */
  const openProject = useCallback((projectId: string) => {
    if (!projectId) return;
    router.push(`/projects/${projectId}`);
  }, [router]);
  const [tasks, setTasks] = useState<TaskPayload[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [statusMessage, setStatusMessage] = useState("");
  // ── Join project by invite code ──
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinedOk, setJoinedOk] = useState(false);

  const refreshWorkspaceData = useCallback(async () => {
    if (!activeWorkspaceId) return;
    // projects управляется контекстом — здесь грузим только tasks/analytics.
    const [taskList, analyticsPayload] = await Promise.all([
      api.getTasks(activeWorkspaceId),
      api.getAnalytics(activeWorkspaceId),
    ]);
    setTasks(taskList);
    setAnalytics(analyticsPayload);
  }, [activeWorkspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshWorkspaceData();
  }, [refreshWorkspaceData]);

  const displayTasks = useMemo(() => tasks, [tasks]);

  const groupedTasks = useMemo(
    () => ({
      todo: displayTasks.filter((t) => {
        const s = t.status?.toLowerCase() ?? "";
        return s === "todo" || s === "backlog" || s === "none";
      }),
      inProgress: displayTasks.filter((t) => {
        const s = t.status?.toLowerCase() ?? "";
        return s === "in_progress" || s === "active" || s === "in-progress";
      }),
      review: displayTasks.filter((t) => {
        const s = t.status?.toLowerCase() ?? "";
        return s === "review" || s === "in_review" || s === "in-review";
      }),
      done: displayTasks.filter((t) => {
        const s = t.status?.toLowerCase() ?? "";
        return s === "done" || s === "completed" || s === "closed";
      }),
    }),
    [displayTasks],
  );

  /**
   * Карта `projectId → projectName` для быстрого поиска при отрисовке
   * карточек задач. Используем cross-workspace `allProjects`, чтобы
   * корректно показывать имена проектов даже из guest-workspace.
   */
  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of allProjects) {
      map.set(p.id, p.name);
    }
    return map;
  }, [allProjects]);

  /**
   * Productivity-метрики: velocity (выполнено за неделю + WoW%),
   * cycle time (среднее время «создано → завершено», в днях) и
   * active now (in progress + review). Считаем из `tasks` напрямую,
   * т.к. бэкенд-AnalyticsPayload time-series не отдаёт.
   */
  const productivity = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(weekStart.getDate() - 7);

    let velocityThisWeek = 0;
    let velocityPrevWeek = 0;
    const cycleDurations: number[] = [];
    let activeNow = 0;

    for (const task of displayTasks) {
      const completed = safeDate(task.completedAt);
      if (completed) {
        if (completed >= weekStart && completed <= now) velocityThisWeek++;
        else if (completed >= prevWeekStart && completed < weekStart) velocityPrevWeek++;
        const created = safeDate(task.createdAt);
        if (created && completed >= created) {
          cycleDurations.push((completed.getTime() - created.getTime()) / 86_400_000);
        }
      }
      const s = task.status?.toLowerCase() ?? "";
      if (
        s === "in_progress" || s === "active" || s === "in-progress" ||
        s === "review" || s === "in_review" || s === "in-review"
      ) {
        activeNow++;
      }
    }

    const cycleDaysAvg = cycleDurations.length
      ? cycleDurations.reduce((a, b) => a + b, 0) / cycleDurations.length
      : null;

    // WoW% delta — округляем до целого. При нуле в прошлой неделе и
    // ненулевом в текущей считаем за +100% («рост с нуля»); при двойном
    // нуле — 0%, чтобы UI не показывал «∞%».
    const wowDelta = velocityThisWeek - velocityPrevWeek;
    const wowPct =
      velocityPrevWeek > 0
        ? Math.round((wowDelta / velocityPrevWeek) * 100)
        : velocityThisWeek > 0 ? 100 : 0;

    return {
      velocityThisWeek,
      velocityPrevWeek,
      wowDelta,
      wowPct,
      cycleDaysAvg,
      activeNow,
    };
  }, [displayTasks]);

  /**
   * Извлекает чистый токен из пользовательского ввода. Принимает:
   *   - голый токен (32-hex) или короткий код,
   *   - полную ссылку `https://.../invite/<token>` или `/invite/<token>`.
   * Возвращает токен в lowercase или null, если строка пустая.
   */
  const parseInviteToken = (raw: string): string | null => {
    const s = raw.trim();
    if (!s) return null;
    try {
      const url = s.startsWith("http") ? new URL(s) : new URL(s, "http://x.local");
      const idx = url.pathname.toLowerCase().lastIndexOf("/invite/");
      if (idx >= 0) {
        const tail = url.pathname.slice(idx + "/invite/".length).replace(/\/.*/, "");
        if (tail) return tail.toLowerCase();
      }
    } catch {
      // не URL — продолжаем как plain
    }
    return s.toLowerCase();
  };

  /**
   * Принять приглашение по коду/ссылке. На бэке `redeemProjectInvitation`
   * валидирует токен (статус, истечение, лимит), добавляет текущего пользователя
   * в проект как `STANDARD`/`GUEST` и помечает приглашение `accepted`. После
   * успеха обновляем список проектов в workspace shell и переходим на доску.
   */
  const handleJoin = async () => {
    const token = parseInviteToken(joinCode);
    if (!token) {
      setJoinError(d.joinInvalid);
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const result = await api.redeemProjectInvitation(token);
      setJoinedOk(true);
      setStatusMessage(d.joinSuccess);
      // Подтянем workspaces + все мои проекты, чтобы сайдбар сразу показал
      // новый проект (и новый guest-workspace, если он только что появился).
      await refreshAll().catch(() => undefined);
      window.setTimeout(() => {
        // Достаточно soft-navigate: workspace shell уже подтянул новые данные,
        // а ProjectBoardPage сама синхронизирует `activeWorkspaceId`
        // через `setActiveWorkspaceId(proj.workspaceId)`.
        router.push(`/projects/${result.projectId}`);
      }, 700);
    } catch (e) {
      console.error("Failed to redeem invitation:", e);
      setJoinError(e instanceof Error ? e.message : d.joinInvalid);
    } finally {
      setJoining(false);
    }
  };

  /** Серия за 7 дней для recharts: число задач, созданных и завершённых
   *  по дням. Считается из `tasks.createdAt`/`tasks.completedAt`, без
   *  отдельного запроса к analytics — backend пока не отдаёт time-series. */
  const weeklyData = useMemo(() => buildWeeklySeries(displayTasks), [displayTasks]);

  const throughput = analytics?.throughput ?? displayTasks.filter(tk => tk.status === "done").length;

  /**
   * Стат-карточки. Productivity-фокус: velocity (за неделю), throughput,
   * active now, cycle time. Total tasks / overdue / completion% намеренно
   * не рендерятся в шапке — пользователь явно убрал лишние KPI-чипы.
   */
  const wowSign = productivity.wowDelta > 0 ? "+" : productivity.wowDelta < 0 ? "−" : "±";
  const wowAbs = Math.abs(productivity.wowPct);
  // «Без изменений» показываем, когда дельта ровно ноль (включая
  // двойной ноль или одинаковые недели). Так избегаем странного «±0%».
  const velocitySub =
    productivity.wowDelta === 0
      ? d.velocityFlat
      : `${wowSign}${wowAbs}% ${d.velocityUp}`;
  const cycleValue =
    productivity.cycleDaysAvg !== null
      ? `${Math.round(productivity.cycleDaysAvg * 10) / 10}d`
      : "—";
  const cycleSub = productivity.cycleDaysAvg !== null ? d.cycleTimeSub : d.cycleNoData;

  const statCards = [
    {
      label: d.velocity,
      value: productivity.velocityThisWeek.toLocaleString(),
      sub: velocitySub,
      icon: ArrowUpRight01Icon,
      color: "bg-emerald-500/10 text-emerald-600",
    },
    {
      label: d.throughput,
      value: throughput.toLocaleString(),
      sub: d.completedLabel,
      icon: CheckmarkCircle02Icon,
      color: "bg-accent/10 text-accent",
    },
    {
      label: d.activeNow,
      value: productivity.activeNow.toLocaleString(),
      sub: d.activeNowSub,
      icon: Task01Icon,
      color: "bg-violet-500/10 text-violet-600",
    },
    {
      label: d.cycleTime,
      value: cycleValue,
      sub: cycleSub,
      icon: AlertCircleIcon,
      color: "bg-amber-500/10 text-amber-600",
    },
  ];

  const columns = [
    { key: "todo", title: d.todo, items: groupedTasks.todo, dot: "bg-gray-400" },
    { key: "inProgress", title: d.inProgress, items: groupedTasks.inProgress, dot: "bg-accent" },
    { key: "review", title: d.review, items: groupedTasks.review, dot: "bg-amber-500" },
    { key: "done", title: d.done, items: groupedTasks.done, dot: "bg-emerald-500" },
  ];

  /**
   * Лента активности — реальные события задач из `getTasks`.
   * Берём 5 последних событий (создание/завершение задачи), сортируем
   * по убыванию времени. Иконка и цвет зависят от типа события.
   * Бэкенд BC «Activity» отсутствует, поэтому композим из имеющихся
   * полей (`createdAt` / `completedAt`).
   */
  const activityFeed = useMemo(() => {
    const labels = {
      timeNow: d.timeNow,
      timeMinutes: d.timeMinutes,
      timeHours: d.timeHours,
      timeDays: d.timeDays,
    };
    return buildRecentEvents(displayTasks, 5).map((event) => ({
      id: event.id,
      taskId: event.taskId,
      projectId: event.projectId,
      title: event.taskTitle,
      meta: `${event.kind === "completed" ? d.eventCompleted : d.eventCreated} · ${formatRelativeTime(event.at.toISOString(), labels)}`,
      Icon: event.kind === "completed" ? CheckmarkCircle02Icon : Task01Icon,
      ring:
        event.kind === "completed"
          ? "bg-emerald-500/12 text-emerald-500"
          : "bg-accent/10 text-accent",
    }));
  }, [displayTasks, d]);

  return (
    <ViewTransition enter="vt-page" exit="vt-page" default="none">
      <section className="w-full">
        {/* Header row */}
        <Fade delay={0} className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">{d.title}</h1>
            <p className="text-sm text-muted mt-1">{d.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {statusMessage && (
              <Chip color="success" variant="soft" size="sm">{statusMessage}</Chip>
            )}
          </div>
        </Fade>

        {/* Row 1: Stat cards + inline quick-add */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-5">
          {statCards.map((stat, i) => {
            // Поддерживаем как чисто-числовые значения ("8", "85%"), так и
            // нечисленные ("2.3d", "—"). Для дробных или нечисленных значений
            // отключаем `SlidingNumber` и рендерим строку as-is — анимировать
            // дробь он не умеет, а строки тем более.
            const pureMatch = stat.value.match(/^(\d+)(%?)$/);
            const numericValue = pureMatch ? parseInt(pureMatch[1], 10) : null;
            const valueSuffix = pureMatch ? pureMatch[2] : "";
            return (
              <Fade key={stat.label} delay={i * 60} initialY={12}>
                <Card className="group relative overflow-hidden h-full">
                  <Card.Content className="flex flex-col p-3">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${stat.color.split(" ")[0]}`}>
                        <stat.icon size={28} strokeWidth={1.5} className={stat.color.split(" ")[1]} />
                      </div>
                      <p className="text-3xl sm:text-4xl font-bold tracking-tight m-0 tabular-nums">
                        {numericValue !== null ? (
                          <>
                            <SlidingNumber value={numericValue} />
                            {valueSuffix}
                          </>
                        ) : (
                          stat.value
                        )}
                      </p>
                    </div>
                    <Text color="muted" className="m-0 text-sm font-medium">{stat.label}</Text>
                    <Text color="muted" className="m-0 mt-0.5 text-xs">{stat.sub}</Text>
                  </Card.Content>
                </Card>
              </Fade>
            );
          })}

          {/* Join project by invite code — 5th column on lg.
              Принимает голый токен или полную ссылку `/invite/<token>`, валидирует
              на бэке через `redeemProjectInvitation` и сразу же редиректит
              пользователя на доску только что вступленного проекта. */}
          <Card className="col-span-2 sm:col-span-4 lg:col-span-1">
            <Card.Content className="px-4 py-3 flex flex-col justify-between h-full gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <UserAdd01Icon size={14} strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <Text className="m-0 font-semibold text-sm leading-tight">{d.joinTitle}</Text>
                  <Text color="muted" className="m-0 text-[11px] leading-tight">{d.joinHint}</Text>
                </div>
              </div>
              <Input
                id="join-code"
                fullWidth
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value);
                  if (joinError) setJoinError(null);
                }}
                placeholder={d.joinPlaceholder}
                disabled={joining || joinedOk}
                onKeyDown={(e) => { if (e.key === "Enter") void handleJoin(); }}
              />
              <Button
                fullWidth
                size="sm"
                onPress={() => void handleJoin()}
                isDisabled={!joinCode.trim() || joining || joinedOk}
              >
                {joinedOk ? (
                  <>
                    <CheckmarkCircle02Icon size={14} strokeWidth={1.8} />
                    {d.joinSuccess}
                  </>
                ) : joining ? (
                  d.joining
                ) : (
                  <>
                    {d.joinAction}
                    <ArrowRight01Icon size={14} strokeWidth={1.8} />
                  </>
                )}
              </Button>
              {joinError && (
                <p className="m-0 text-[11px] leading-tight text-red-500">{joinError}</p>
              )}
            </Card.Content>
          </Card>
        </div>

        {/* Row 2: Area chart + Sprint progress side by side */}
        <Fade delay={280} className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mb-5">
          <Card className="flex h-[420px] flex-col">
            <Card.Header>
              <Card.Title>{d.productivityTrends}</Card.Title>
              <Card.Description>{d.focusHours}</Card.Description>
            </Card.Header>
            <Card.Content className="min-h-0 flex-1 px-4 pb-4 pt-0">
              <div className="h-full w-full min-h-[260px] sm:min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData} margin={{ top: 8, right: 0, left: -45, bottom: 4 }}>
                    <defs>
                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(62.04% 0.195 253.83)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(62.04% 0.195 253.83)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="var(--muted)" tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                    <Area type="monotone" dataKey="completed" name={d.seriesCompleted} stroke="oklch(62.04% 0.195 253.83)" strokeWidth={2.5} fill="url(#colorHours)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card.Content>
          </Card>

          {/* Recent tasks */}
          <div className="flex flex-col">
            <Card className="flex h-[420px] flex-col">
              <Card.Header className="pb-2">
                <div className="flex items-center justify-between">
                  <Card.Title>{d.recentTasks}</Card.Title>
                  <Badge size="sm" variant="soft" color="accent">{displayTasks.length}</Badge>
                </div>
                <Card.Description>{d.assignedToYou}</Card.Description>
              </Card.Header>
              <Card.Content className="min-h-0 flex-1 px-2 pb-2 pt-0">
                <ScrollArea className="h-full pr-2">
                  <div className="flex flex-col gap-1">
                    {displayTasks.map((task, idx) => {
                      const projectName = task.projectId ? projectNameById.get(task.projectId) : undefined;
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => openTask(task)}
                          aria-label={`${d.openInProject}: ${task.title}`}
                          className={`group flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-secondary/60 ${idx !== 0 ? "border-t border-border/30" : ""}`}
                        >
                          <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${task.status === "done" ? "bg-emerald-500/10" :
                            task.status === "in_progress" ? "bg-accent/10" :
                              task.priority === "high" ? "bg-red-500/10" :
                                "bg-surface-secondary"
                            }`}>
                            <Task01Icon size={18} strokeWidth={1.6} className={
                              task.status === "done" ? "text-emerald-500" :
                                task.status === "in_progress" ? "text-accent" :
                                  task.priority === "high" ? "text-red-500" :
                                    "text-muted"
                            } />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium m-0 truncate">{task.title}</p>
                            <div className="flex items-center gap-2 mt-1 min-w-0">
                              <span className={`shrink-0 whitespace-nowrap text-[11px] px-2 py-0.5 rounded-md font-medium ${task.status === "done" ? "bg-emerald-500/10 text-emerald-600" :
                                task.status === "in_progress" ? "bg-accent/10 text-accent" :
                                  task.status === "review" ? "bg-amber-500/10 text-amber-600" :
                                    "bg-surface-secondary text-muted"
                                }`}>
                                {statusLabel(task.status)}
                              </span>
                              {projectName && (
                                <span className="text-[11px] text-muted truncate min-w-0" title={projectName}>
                                  {projectName}
                                </span>
                              )}
                              {task.dueDate && (
                                <span className="text-[11px] text-muted shrink-0 whitespace-nowrap">
                                  {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                          </div>
                          <ArrowUpRight01Icon size={14} strokeWidth={1.8} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      );
                    })}
                    {displayTasks.length === 0 && (
                      <div className="py-8 text-center">
                        <Text color="muted">{d.noTasksYet}</Text>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </Card.Content>
            </Card>
          </div>
        </Fade>

        {/* Row 3: Task board — full width */}
        <Fade delay={400}>
          <Card className="mb-5">
            <Card.Header>
              <div className="flex items-center gap-3 min-w-0">
                <Card.Title className="truncate">{d.sprintBoardTitle}</Card.Title>
                <div className="flex items-center gap-1 ml-1">
                  <button type="button" title="Board" onClick={() => setViewMode("board")} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${viewMode === "board" ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface-secondary"}`}>
                    <GridViewIcon size={16} strokeWidth={1.8} />
                  </button>
                  <button type="button" title="List" onClick={() => setViewMode("list")} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${viewMode === "list" ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface-secondary"}`}>
                    <Menu01Icon size={16} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </Card.Header>
            <Card.Content className="px-4 pb-4 pt-0">
              {viewMode === "board" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {columns.map((col) => (
                    <div key={col.key} className="rounded-xl bg-surface-secondary/30 p-3">
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                        <Text className="font-semibold m-0 text-sm">{col.title}</Text>
                        <Badge color="default" className="ml-auto">{col.items.length}</Badge>
                      </div>
                      <div className="grid gap-2">
                        {col.items.map((task) => {
                          const projectName = task.projectId ? projectNameById.get(task.projectId) : undefined;
                          return (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => openTask(task)}
                              aria-label={`${d.openInProject}: ${task.title}`}
                              className="rounded-xl bg-surface border border-border/30 p-3.5 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 cursor-pointer text-left w-full"
                            >
                              <div className="flex items-start gap-2.5">
                                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${priorityDot(task.priority)}`} />
                                <div className="min-w-0 flex-1">
                                  <Text className="font-medium m-0 leading-snug text-sm">{task.title}</Text>
                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <Text color="muted" className="m-0 text-xs">{task.dueDate ?? d.noDeadline}</Text>
                                    {projectName && (
                                      <span
                                        role="link"
                                        tabIndex={0}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (task.projectId) openProject(task.projectId);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (task.projectId) openProject(task.projectId);
                                          }
                                        }}
                                        className="m-0 text-[10px] rounded-md bg-surface-secondary px-1.5 py-0.5 text-muted hover:bg-accent/10 hover:text-accent transition-colors cursor-pointer truncate max-w-[140px]"
                                        title={projectName}
                                      >
                                        {projectName}
                                      </span>
                                    )}
                                    {task.labels[0] && (
                                      <Chip size="sm" color="default" variant="secondary">{task.labels[0]}</Chip>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        {col.items.length === 0 && (
                          <div className="py-8 text-center">
                            <Text color="muted" className="text-sm">{d.empty}</Text>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-0.5">
                  {displayTasks.map((task) => {
                    const projectName = task.projectId ? projectNameById.get(task.projectId) : undefined;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => openTask(task)}
                        aria-label={`${d.openInProject}: ${task.title}`}
                        className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-surface-secondary/40 transition-colors"
                      >
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${priorityDot(task.priority)}`} />
                        <Text className="font-medium m-0 flex-1 truncate text-sm">{task.title}</Text>
                        {projectName && (
                          <Text color="muted" className="m-0 hidden md:block text-xs truncate max-w-[160px]" title={projectName}>
                            {projectName}
                          </Text>
                        )}
                        <Text color="muted" className="m-0 hidden sm:block text-xs">{task.dueDate ?? "—"}</Text>
                        <Chip size="sm" color={statusColor(task.status)} variant="soft">{statusLabel(task.status)}</Chip>
                      </button>
                    );
                  })}
                  {displayTasks.length === 0 && (
                    <div className="py-8 text-center"><Text color="muted">{d.noTasksYet}</Text></div>
                  )}
                </div>
              )}
            </Card.Content>
          </Card>
        </Fade>

        {/* Row 4: Bar chart + Activity — equal height; activity list fills card to bottom */}
        <Fade delay={520} className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
          <Card className="flex h-full min-h-0 flex-col">
            <Card.Header className="shrink-0">
              <Card.Title>{d.taskDist}</Card.Title>
              <Card.Description>{d.perDayWeek}</Card.Description>
            </Card.Header>
            <Card.Content className="flex min-h-0 flex-1 flex-col px-1.5 pb-0 pt-0 sm:px-2">
              <div className="h-[168px] w-full min-h-[168px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weeklyData}
                    margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                    barCategoryGap="12%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10 }}
                      stroke="var(--muted)"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={2}
                      height={14}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="var(--muted)"
                      tickLine={false}
                      axisLine={false}
                      width={22}
                      domain={[0, "dataMax + 2"]}
                      tickCount={5}
                    />
                    <RechartsTooltip contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                    <Bar dataKey="created" name={d.seriesCreated} fill="oklch(62.04% 0.195 253.83)" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Content>
          </Card>

          <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <Card.Header className="shrink-0 px-4 pb-2 pt-4">
              <Card.Title>{d.activity}</Card.Title>
              <Card.Description>{d.activityPulse}</Card.Description>
            </Card.Header>
            <Card.Content className="flex min-h-0 flex-1 flex-col p-0">
              <ScrollArea className="min-h-0 flex-1 basis-0 px-4">
                {activityFeed.length === 0 ? (
                  <div className="py-8 text-center">
                    <Text color="muted" className="text-sm">{d.noActivityYet}</Text>
                  </div>
                ) : (
                  <ul className="m-0 list-none divide-y divide-[var(--border)]/55 p-0">
                    {activityFeed.map((row) => {
                      const canOpen = !!row.projectId;
                      return (
                        <li key={row.id} className="first:pt-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (canOpen) openTask({ id: row.taskId, projectId: row.projectId });
                            }}
                            disabled={!canOpen}
                            aria-label={canOpen ? `${d.openInProject}: ${row.title}` : row.title}
                            className={`flex w-full gap-3 py-3 text-left transition-colors ${canOpen ? "cursor-pointer hover:bg-surface-secondary/40 rounded-lg -mx-2 px-2" : "cursor-default"}`}
                          >
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${row.ring}`}>
                              <row.Icon size={17} strokeWidth={1.7} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="m-0 text-sm font-medium leading-snug text-[var(--foreground)] truncate">{row.title}</p>
                              <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--muted)]">{row.meta}</p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            </Card.Content>
          </Card>
        </Fade>
      </section>
    </ViewTransition>
  );
}
