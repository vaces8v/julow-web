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
  Add01Icon,
  Calendar01Icon,
  Mail01Icon,
  PaintBrush01Icon,
  SourceCodeIcon,
  Rocket01Icon,
  LinkSquare02Icon,
  GridViewIcon,
  Menu01Icon,
} from "hugeicons-react";
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
  ProjectPayload,
  TaskPayload,
} from "@/lib/api";

const weeklyData = [
  { day: "Mon", hours: 3.2, tasks: 5 },
  { day: "Tue", hours: 4.1, tasks: 7 },
  { day: "Wed", hours: 2.8, tasks: 4 },
  { day: "Thu", hours: 5.0, tasks: 9 },
  { day: "Fri", hours: 4.5, tasks: 6 },
  { day: "Sat", hours: 1.2, tasks: 2 },
  { day: "Sun", hours: 0.8, tasks: 1 },
];

type ViewMode = "board" | "list";

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
  const { activeWorkspaceId, activeProjectId } = useWorkspaceShell();
  const { t } = useI18n();
  const d = t.dashboard;
  const [projects, setProjects] = useState<ProjectPayload[]>([]);
  const [tasks, setTasks] = useState<TaskPayload[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [statusMessage, setStatusMessage] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const refreshWorkspaceData = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const [projectList, taskList, analyticsPayload] = await Promise.all([
      api.getProjects(activeWorkspaceId),
      api.getTasks(activeWorkspaceId),
      api.getAnalytics(activeWorkspaceId),
    ]);
    setProjects(projectList);
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

  const progressValue = useMemo(() => {
    if (!analytics?.totalTasks) return 0;
    return Math.round((analytics.throughput / analytics.totalTasks) * 100);
  }, [analytics]);

  const createTask = async () => {
    if (!activeWorkspaceId || !newTaskTitle.trim()) return;
    const projectId = activeProjectId || projects[0]?.id;
    if (!projectId) return;
    await api.createTask({
      workspaceId: activeWorkspaceId,
      projectId,
      title: newTaskTitle.trim(),
      status: "todo",
      priority: "medium",
      labels: ["mvp"],
    });
    setNewTaskTitle("");
    await refreshWorkspaceData();
    setStatusMessage("Задача добавлена");
    setTimeout(() => setStatusMessage(""), 3000);
  };

  const syncCalendar = async () => {
    if (!activeWorkspaceId) return;
    await api.syncCalendar(activeWorkspaceId);
    setStatusMessage("Calendar synced");
    setTimeout(() => setStatusMessage(""), 3000);
  };

  const sendDigest = async () => {
    if (!activeWorkspaceId) return;
    await api.sendEmailDigest(activeWorkspaceId);
    await refreshWorkspaceData();
    setStatusMessage("Digest sent");
    setTimeout(() => setStatusMessage(""), 3000);
  };

  const totalTasks = analytics?.totalTasks ?? displayTasks.length;
  const throughput = analytics?.throughput ?? displayTasks.filter(tk => tk.status === "done").length;
  const overdue = analytics?.overdue ?? displayTasks.filter(tk => tk.dueDate && new Date(tk.dueDate) < new Date() && tk.status !== "done").length;

  const statCards = [
    { label: d.totalTasks, value: totalTasks.toLocaleString(), sub: d.allActive, icon: Task01Icon, color: "bg-accent/10 text-accent" },
    { label: d.throughput, value: throughput.toLocaleString(), sub: d.completedLabel, icon: CheckmarkCircle02Icon, color: "bg-emerald-500/10 text-emerald-600" },
    { label: d.overdue, value: overdue.toLocaleString(), sub: d.needAttention, icon: AlertCircleIcon, color: "bg-red-500/10 text-red-500" },
    { label: d.completion, value: `${progressValue}%`, sub: d.thisSprint, icon: ArrowUpRight01Icon, color: "bg-violet-500/10 text-violet-600" },
  ];

  const columns = [
    { key: "todo", title: d.todo, items: groupedTasks.todo, dot: "bg-gray-400" },
    { key: "inProgress", title: d.inProgress, items: groupedTasks.inProgress, dot: "bg-accent" },
    { key: "review", title: d.review, items: groupedTasks.review, dot: "bg-amber-500" },
    { key: "done", title: d.done, items: groupedTasks.done, dot: "bg-emerald-500" },
  ];

  const activityFeed = useMemo(
    () =>
      [
        { title: d.feed1, meta: d.feed1m, Icon: PaintBrush01Icon, ring: "bg-violet-500/12 text-violet-400" },
        { title: d.feed2, meta: d.feed2m, Icon: SourceCodeIcon, ring: "bg-accent/12 text-accent" },
        { title: d.feed3, meta: d.feed3m, Icon: Rocket01Icon, ring: "bg-emerald-500/12 text-emerald-400" },
        { title: d.feed4, meta: d.feed4m, Icon: LinkSquare02Icon, ring: "bg-amber-500/12 text-amber-500" },
        { title: d.feed5, meta: d.feed5m, Icon: Calendar01Icon, ring: "bg-[var(--surface-secondary)] text-[var(--muted)]" },
      ] as const,
    [d],
  );

  return (
    <ViewTransition enter="vt-page" exit="vt-page" default="none">
      <section className="w-full">
        {/* Header row */}
        <Fade delay={0} className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">{d.title}</h1>
            <p className="text-sm text-muted mt-1">{d.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {statusMessage && (
              <Chip color="success" variant="soft" size="sm">{statusMessage}</Chip>
            )}
            <Button size="sm" variant="secondary" onPress={syncCalendar}>
              <Calendar01Icon size={15} />
              {d.sync}
            </Button>
            <Button size="sm" onPress={sendDigest}>
              <Mail01Icon size={15} />
              {d.digest}
            </Button>
          </div>
        </Fade>

        {/* Row 1: Stat cards + inline quick-add */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-5">
          {statCards.map((stat, i) => {
            const numericValue = parseInt(stat.value.replace(/[^0-9]/g, ""), 10);
            const isPercent = stat.value.includes("%");
            return (
              <Fade key={stat.label} delay={i * 60} initialY={12}>
                <Card className="group relative overflow-hidden h-full">
                  <Card.Content className="flex flex-col p-3">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${stat.color.split(" ")[0]}`}>
                        <stat.icon size={28} strokeWidth={1.5} className={stat.color.split(" ")[1]} />
                      </div>
                      <p className="text-3xl sm:text-4xl font-bold tracking-tight m-0 tabular-nums">
                        <SlidingNumber value={isNaN(numericValue) ? 0 : numericValue} />
                        {isPercent && "%"}
                      </p>
                    </div>
                    <Text variant="muted" className="m-0 text-sm font-medium">{stat.label}</Text>
                    <Text variant="muted" className="m-0 mt-0.5 text-xs">{stat.sub}</Text>
                  </Card.Content>
                </Card>
              </Fade>
            );
          })}

          {/* Inline quick-add — 5th column on lg */}
          <Card className="col-span-2 sm:col-span-4 lg:col-span-1">
            <Card.Content className="px-4 py-3 flex flex-col justify-between h-full gap-2">
              <Text className="m-0 font-semibold text-sm">{d.quickAdd}</Text>
              <Input
                id="quick-task"
                fullWidth
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder={d.newTask}
                onKeyDown={(e) => { if (e.key === "Enter") void createTask(); }}
              />
              <Button fullWidth size="sm" onPress={createTask}>
                <Add01Icon size={14} />
                {d.add}
              </Button>
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
                    <Area type="monotone" dataKey="hours" stroke="oklch(62.04% 0.195 253.83)" strokeWidth={2.5} fill="url(#colorHours)" />
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
                    {displayTasks.map((task, idx) => (
                      <div
                        key={task.id}
                        className={`group flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-surface-secondary/60 ${idx !== 0 ? "border-t border-border/30" : ""}`}
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
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${task.status === "done" ? "bg-emerald-500/10 text-emerald-600" :
                              task.status === "in_progress" ? "bg-accent/10 text-accent" :
                                task.status === "review" ? "bg-amber-500/10 text-amber-600" :
                                  "bg-surface-secondary text-muted"
                              }`}>
                              {statusLabel(task.status)}
                            </span>
                            {task.dueDate && (
                              <span className="text-[10px] text-muted">
                                {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowUpRight01Icon size={14} strokeWidth={1.8} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    ))}
                    {displayTasks.length === 0 && (
                      <div className="py-8 text-center">
                        <Text variant="muted">No tasks assigned</Text>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </Card.Content>
            </Card>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button size="sm" onPress={syncCalendar} className="w-full">
                <Calendar01Icon size={14} />
                {d.sync}
              </Button>
              <Button variant="secondary" size="sm" onPress={sendDigest} className="w-full">
                <Mail01Icon size={14} />
                {d.digest}
              </Button>
            </div>
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
                        {col.items.map((task) => (
                          <div key={task.id} className="rounded-xl bg-surface border border-border/30 p-3.5 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 cursor-pointer">
                            <div className="flex items-start gap-2.5">
                              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${priorityDot(task.priority)}`} />
                              <div className="min-w-0 flex-1">
                                <Text className="font-medium m-0 leading-snug text-sm">{task.title}</Text>
                                <div className="flex items-center gap-2 mt-2">
                                  <Text variant="muted" className="m-0 text-xs">{task.dueDate ?? d.noDeadline}</Text>
                                  {task.labels[0] && (
                                    <Chip size="sm" color="default" variant="secondary">{task.labels[0]}</Chip>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {col.items.length === 0 && (
                          <div className="py-8 text-center">
                            <Text variant="muted" className="text-sm">{d.empty}</Text>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-0.5">
                  {displayTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-surface-secondary/40 transition-colors">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${priorityDot(task.priority)}`} />
                      <Text className="font-medium m-0 flex-1 text-sm">{task.title}</Text>
                      <Text variant="muted" className="m-0 hidden sm:block text-xs">{task.dueDate ?? "—"}</Text>
                      <Chip size="sm" color={statusColor(task.status)} variant="soft">{statusLabel(task.status)}</Chip>
                    </div>
                  ))}
                  {displayTasks.length === 0 && (
                    <div className="py-8 text-center"><Text variant="muted">{d.noTasksYet}</Text></div>
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
                    <Bar dataKey="tasks" fill="oklch(62.04% 0.195 253.83)" radius={[4, 4, 0, 0]} maxBarSize={48} />
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
                <ul className="m-0 list-none divide-y divide-[var(--border)]/55 p-0">
                  {activityFeed.map((row) => (
                    <li key={row.title} className="flex gap-3 py-3 first:pt-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${row.ring}`}>
                        <row.Icon size={17} strokeWidth={1.7} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-sm font-medium leading-snug text-[var(--foreground)]">{row.title}</p>
                        <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--muted)]">{row.meta}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </Card.Content>
          </Card>
        </Fade>
      </section>
    </ViewTransition>
  );
}
