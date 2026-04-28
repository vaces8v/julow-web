"use client";

import { use, useRef, useState, useEffect, startTransition, ViewTransition } from "react";
import { Badge, Button, Chip, Input, Text } from "@heroui/react";
import {
  Add01Icon,
  ArrowLeft01Icon,
  Calendar01Icon,
  GridViewIcon,
  Menu01Icon,
  MoreHorizontalIcon,
  Search01Icon,
} from "hugeicons-react";
import Link from "next/link";
import { Fade } from "@/components/ui/fade";
import { AnimatePresence, motion } from "motion/react";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import { api, type TaskPayload, type ProjectPayload } from "@/lib/api";
import { useI18n, type Locale } from "@/i18n/context";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";

const COLUMN_MAX_H = "calc(100dvh - 200px)";

function formatDueDate(value: string, locale: Locale) {
  const localeTag = locale === "ru" ? "ru-RU" : locale === "de" ? "de-DE" : "en-US";
  return new Date(value).toLocaleDateString(localeTag, { month: "short", day: "numeric" });
}

/* ── Types ────────────────────────────── */
type Priority = "critical" | "high" | "medium" | "low" | "none";

type BoardTask = {
  id: string;
  title: string;
  priority: Priority;
  status: string;
  labels: string[];
  dueDate?: string;
  projectId: string;
};

type Column = {
  id: string;
  labelKey: "todo" | "inProgress" | "inReview" | "done";
  dotColor: string;
  tasks: BoardTask[];
};

const PRIO: Record<string, { key: "priorityCritical" | "priorityHigh" | "priorityMedium" | "priorityLow" | "priorityNone"; color: string; dot: string }> = {
  critical: { key: "priorityCritical", color: "text-red-500", dot: "bg-red-500" },
  high: { key: "priorityHigh", color: "text-orange-500", dot: "bg-orange-400" },
  medium: { key: "priorityMedium", color: "text-amber-500", dot: "bg-amber-400" },
  low: { key: "priorityLow", color: "text-slate-400", dot: "bg-slate-300" },
  none: { key: "priorityNone", color: "text-slate-400", dot: "bg-slate-200" },
};

const STATUS_MAP: Record<string, { key: "todo" | "backlog" | "inProgress" | "review" | "done"; color: "default" | "accent" | "warning" | "success" }> = {
  todo: { key: "todo", color: "default" },
  backlog: { key: "backlog", color: "default" },
  none: { key: "todo", color: "default" },
  in_progress: { key: "inProgress", color: "accent" },
  active: { key: "inProgress", color: "accent" },
  review: { key: "review", color: "warning" },
  in_review: { key: "review", color: "warning" },
  done: { key: "done", color: "success" },
  completed: { key: "done", color: "success" },
  closed: { key: "done", color: "success" },
};

function statusToColumnKey(status: string): string {
  const s = status?.toLowerCase() ?? "";
  if (s === "done" || s === "completed" || s === "closed") return "done";
  if (s === "review" || s === "in_review" || s === "in-review") return "review";
  if (s === "in_progress" || s === "active" || s === "in-progress") return "in_progress";
  return "todo";
}

function taskToBoardTask(t: TaskPayload): BoardTask {
  return {
    id: t.id,
    title: t.title,
    priority: (t.priority?.toLowerCase() ?? "none") as Priority,
    status: t.status,
    labels: t.labels,
    dueDate: t.dueDate,
    projectId: t.projectId,
  };
}

const FALLBACK_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#f97316", "#22c55e",
  "#ec4899", "#14b8a6", "#f59e0b", "#6366f1", "#ef4444",
];

const DEFAULT_COLUMNS: Column[] = [
  { id: "todo", labelKey: "todo", dotColor: "bg-slate-400", tasks: [] },
  { id: "in_progress", labelKey: "inProgress", dotColor: "bg-blue-500", tasks: [] },
  { id: "review", labelKey: "inReview", dotColor: "bg-amber-500", tasks: [] },
  { id: "done", labelKey: "done", dotColor: "bg-emerald-500", tasks: [] },
];

function buildColumns(tasks: BoardTask[]): Column[] {
  const map = new Map<string, BoardTask[]>();
  for (const t of tasks) {
    const key = statusToColumnKey(t.status);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return DEFAULT_COLUMNS.map((col) => ({
    ...col,
    tasks: map.get(col.id) ?? [],
  }));
}

/* ── TaskCard ──────────────────────────── */
function TaskCard({
  task, isSelected, isDragging, onSelect,
  onDragStart, onDragEnd,
  copy,
  locale,
}: {
  task: BoardTask;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  copy: ReturnType<typeof useI18n>["t"]["projects"];
  locale: Locale;
}) {
  const prio = PRIO[task.priority] ?? PRIO.none;
  const statusInfo = STATUS_MAP[task.status] ?? STATUS_MAP.todo;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`group cursor-pointer select-none rounded-xl border transition-all duration-150
        ${isDragging ? "opacity-40 scale-[0.97]" : ""}
        ${isSelected
          ? "border-accent/60 bg-accent/5 shadow-sm shadow-accent/10"
          : "border-[var(--border)]/60 bg-[var(--surface)] hover:border-[var(--border)] hover:shadow-sm"
        }`}
    >
      <div className="p-3.5">
        {task.labels.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1">
            {task.labels.slice(0, 3).map((l: string) => (
              <span key={l} className="rounded-full bg-[var(--surface-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                {l}
              </span>
            ))}
          </div>
        )}
        <p className="m-0 text-[13px] font-medium leading-snug">{task.title}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${prio.dot}`} />
            <span className={`text-[10px] font-medium ${prio.color}`}>{copy[prio.key]}</span>
            {task.dueDate && (
              <>
                <span className="text-[var(--muted)]/40">·</span>
                <span className="flex items-center gap-0.5 text-[10px] text-[var(--muted)]">
                  <Calendar01Icon size={10} strokeWidth={2} />
                  {formatDueDate(task.dueDate, locale)}
                </span>
              </>
            )}
          </div>
          <Chip size="sm" color={statusInfo.color} variant="soft">
            {copy[statusInfo.key]}
          </Chip>
        </div>
      </div>
    </div>
  );
}

/* ── BoardColumn ───────────────────────── */
function BoardColumn({
  col, selectedId, draggingTaskId, dragOverColId,
  onSelectTask, onAddTask, onDragOver, onDragLeave, onDrop,
  onCardDragStart, onCardDragEnd,
  copy,
  locale,
}: {
  col: Column;
  selectedId: string | null;
  draggingTaskId: string | null;
  dragOverColId: string | null;
  onSelectTask: (id: string) => void;
  onAddTask: (id: string) => void;
  onDragOver: (e: React.DragEvent, colId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, colId: string) => void;
  onCardDragStart: (e: React.DragEvent, taskId: string) => void;
  onCardDragEnd: () => void;
  copy: ReturnType<typeof useI18n>["t"]["projects"];
  locale: Locale;
}) {
  const isDropTarget = dragOverColId === col.id && draggingTaskId !== null;

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-2xl transition-colors duration-150 xl:w-80
        ${isDropTarget
          ? "bg-accent/8 ring-2 ring-accent/25"
          : "bg-[var(--surface-secondary)]/40"
        }`}
      onDragOver={(e) => onDragOver(e, col.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, col.id)}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <span className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
        <span className="text-[13px] font-semibold">{copy[col.labelKey]}</span>
        <Badge size="sm" color="default" variant="soft" className="ml-1">{col.tasks.length}</Badge>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => onAddTask(col.id)}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]">
            <Add01Icon size={13} strokeWidth={2.2} />
          </button>
          <button type="button"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]">
            <MoreHorizontalIcon size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {isDropTarget && (
        <div className="mx-2 mb-1 h-0.5 rounded-full bg-accent/60" />
      )}

      <div
        className="overflow-y-auto px-2 pb-3 scrollbar-thin"
        style={{ maxHeight: COLUMN_MAX_H }}
      >
        <div className="grid gap-2">
          {col.tasks.map((task) => (
            <ViewTransition key={task.id}>
              <TaskCard
                task={task}
                copy={copy}
                locale={locale}
                isSelected={selectedId === task.id}
                isDragging={draggingTaskId === task.id}
                onSelect={() => onSelectTask(task.id === selectedId ? "" : task.id)}
                onDragStart={(e) => onCardDragStart(e, task.id)}
                onDragEnd={onCardDragEnd}
              />
            </ViewTransition>
          ))}
          {col.tasks.length === 0 && !isDropTarget && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--border)]/60 py-8">
              <Text variant="muted" className="m-0 text-xs">{copy.noTasksYet}</Text>
              <button type="button" onClick={() => onAddTask(col.id)} className="text-xs text-accent hover:underline">
                {copy.addTask}
              </button>
            </div>
          )}
          {isDropTarget && col.tasks.length === 0 && (
            <div className="h-16 rounded-xl border-2 border-dashed border-accent/40 bg-accent/5" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── TaskDetail slide-over ─────────────── */
function TaskDetail({ task, onClose, copy, locale }: { task: BoardTask; onClose: () => void; copy: ReturnType<typeof useI18n>["t"]["projects"]; locale: Locale }) {
  const prio = PRIO[task.priority] ?? PRIO.none;
  const statusInfo = STATUS_MAP[task.status] ?? STATUS_MAP.todo;
  return (
    <motion.aside
      key="task-detail"
      initial={{ x: 360, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 360, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 40 }}
      className="fixed right-0 top-0 z-40 flex h-dvh w-[340px] flex-col border-l border-[var(--border)]/60 bg-[var(--surface)] shadow-2xl"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)]/60 px-5 py-4">
        <span className="text-sm font-semibold">{copy.taskDetail}</span>
        <button type="button" onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)]">
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ maxHeight: COLUMN_MAX_H }}>
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-1.5">
            {task.labels.map((l: string) => (
              <span key={l} className="rounded-full bg-[var(--surface-secondary)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                {l}
              </span>
            ))}
          </div>

          <h2 className="m-0 text-base font-bold leading-snug">{task.title}</h2>

          <div className="divide-y divide-[var(--border)]/40 rounded-xl border border-[var(--border)]/60">
            {[
              { label: copy.priority, value: <span className={`flex items-center gap-1.5 text-sm font-medium ${prio.color}`}><span className={`h-2 w-2 rounded-full ${prio.dot}`} />{copy[prio.key]}</span> },
              { label: copy.status, value: <Chip size="sm" color={statusInfo.color} variant="soft">{copy[statusInfo.key]}</Chip> },
              ...(task.dueDate ? [{ label: copy.dueDate, value: <span className="text-sm">{formatDueDate(task.dueDate, locale)}</span> }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-3.5 py-2.5">
                <Text variant="muted" className="m-0 text-xs">{label}</Text>
                <div>{value}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button size="sm" className="flex-1">{copy.editTask}</Button>
            <Button size="sm" variant="secondary">{copy.deleteTask}</Button>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

/* ── Main page ─────────────────────────── */
export function ProjectBoardPage({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);
  const { locale, t } = useI18n();
  const copy = t.projects;
  const { activeWorkspaceId } = useWorkspaceShell();

  const [project, setProject] = useState<ProjectPayload | null>(null);
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS.map((c) => ({ ...c, tasks: [] })));
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<string>("medium");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Load project + tasks
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!activeWorkspaceId) return;
      try {
        const projects = await api.getProjects(activeWorkspaceId);
        const proj = projects.find((p) => p.id === id) ?? null;
        if (cancelled) return;
        setProject(proj);

        if (proj) {
          const tasks = await api.getProjectTasks(activeWorkspaceId, proj.id);
          if (cancelled) return;
          setColumns(buildColumns(tasks.map(taskToBoardTask)));
        }
      } catch {
        // Project or tasks not found
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [activeWorkspaceId, id]);

  const allTasks = columns.flatMap((c) => c.tasks);
  const selectedTask = allTasks.find((t) => t.id === selectedId);

  const handleSearch = (val: string) => {
    startTransition(() => setSearch(val));
  };

  const lc = search.toLowerCase();
  const filteredColumns = search
    ? columns.map((c) => ({
      ...c,
      tasks: c.tasks.filter((t) =>
        t.title.toLowerCase().includes(lc) ||
        t.labels.some((l: string) => l.toLowerCase().includes(lc))
      ),
    }))
    : columns;

  const addTask = async (colId: string) => {
    if (!activeWorkspaceId || !project) return;
    try {
      const newTask = await api.createTask({
        workspaceId: activeWorkspaceId,
        projectId: project.id,
        title: newTaskTitle.trim() || copy.newTask,
        priority: newTaskPriority,
      });
      const boardTask = taskToBoardTask(newTask);
      const targetCol = colId;
      setColumns((prev) => prev.map((c) =>
        statusToColumnKey(boardTask.status) === targetCol || c.id === targetCol
          ? { ...c, tasks: [boardTask, ...c.tasks] }
          : c
      ));
      setSelectedId(boardTask.id);
      setNewTaskTitle("");
      setDialogOpen(false);
    } catch (err) {
      console.error("Failed to create task:", err);
    }
  };

  /* DnD */
  const dragSourceColRef = useRef<string | null>(null);

  const handleCardDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
    setDraggingTask(taskId);
    dragSourceColRef.current = columns.find((c) => c.tasks.some((t) => t.id === taskId))?.id ?? null;
  };

  const handleCardDragEnd = () => {
    setDraggingTask(null);
    setDragOverCol(null);
    dragSourceColRef.current = null;
  };

  const handleColDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
  };

  const handleColDragLeave = () => setDragOverCol(null);

  const handleColDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    const taskId = draggingTask ?? e.dataTransfer.getData("text/plain");
    const srcColId = dragSourceColRef.current;
    if (!taskId || !srcColId || srcColId === targetColId) {
      setDraggingTask(null);
      setDragOverCol(null);
      return;
    }
    startTransition(() => {
      setColumns((prev) => {
        const task = prev.find((c) => c.id === srcColId)?.tasks.find((t) => t.id === taskId);
        if (!task) return prev;
        return prev.map((c) => {
          if (c.id === srcColId) return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
          if (c.id === targetColId) return { ...c, tasks: [{ ...task, status: targetColId }, ...c.tasks] };
          return c;
        });
      });
    });
    // Update status on backend (best-effort)
    if (activeWorkspaceId && project) {
      void api.updateTaskStatus(taskId, targetColId).catch(() => { });
    }
    setDraggingTask(null);
    setDragOverCol(null);
    dragSourceColRef.current = null;
  };

  const totalDone = columns.find((c) => c.id === "done")?.tasks.length ?? 0;
  const totalTasks = allTasks.length;
  const progress = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
  const colorIdx = project ? (project.name.length % FALLBACK_COLORS.length) : 0;
  const color = project?.color ?? FALLBACK_COLORS[colorIdx];

  return (
    <div className="flex flex-col py-5">
      {/* Page header */}
      <Fade delay={0}>
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <Link href="/projects"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] no-underline">
            <ArrowLeft01Icon size={16} strokeWidth={2} />
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: color }}>
              {project?.icon ?? (project?.name ?? "P").split(" ").map((w) => w[0]).join("").slice(0, 2)}
            </div>
            <div>
              <h1 className="m-0 text-xl font-bold tracking-tight">
                {project?.name ?? copy.boardFallbackTitle.replace("{{id}}", id)}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-[var(--muted)]">
                  {copy.tasksCount.replace("{{count}}", String(totalTasks))}
                </span>
                <span className="text-[var(--muted)]/40">·</span>
                <span className="text-[11px] text-[var(--muted)]">
                  {copy.completePercent.replace("{{percent}}", String(progress))}
                </span>
                <div className="h-1.5 w-20 rounded-full bg-[var(--surface-secondary)]">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
                    initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.4 }} />
                </div>
              </div>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex items-center">
              <Search01Icon size={13} strokeWidth={2} className="pointer-events-none absolute left-2.5 text-[var(--muted)]/60" />
              <input type="text" value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={copy.filterTasks}
                className="h-8 w-32 rounded-lg border border-[var(--border)] bg-transparent pl-8 pr-3 text-xs placeholder:text-[var(--muted)]/50 transition-[width,border-color] focus:w-44 focus:border-accent/50 focus:outline-none" />
            </div>

            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-[var(--border)]/60 p-0.5">
              <button type="button" onClick={() => setViewMode("board")}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${viewMode === "board" ? "bg-accent/10 text-accent" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
                <GridViewIcon size={13} strokeWidth={1.8} />
              </button>
              <button type="button" onClick={() => setViewMode("list")}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${viewMode === "list" ? "bg-accent/10 text-accent" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
                <Menu01Icon size={13} strokeWidth={1.8} />
              </button>
            </div>

            {/* New Task dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Add01Icon size={14} /> {copy.newTask}</Button>
              </DialogTrigger>
              <DialogContent from="top">
                <DialogHeader>
                  <DialogTitle>{copy.createTaskTitle}</DialogTitle>
                  <DialogDescription>{copy.createTaskDesc}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">{copy.taskTitle}</label>
                    <Input fullWidth value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder={copy.taskTitlePlaceholder} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">{copy.priority}</label>
                      <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)}
                        className="h-9 appearance-none cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:border-accent/60 focus:outline-none transition-colors">
                        <option value="none">{copy.priorityNone}</option><option value="low">{copy.priorityLow}</option><option value="medium">{copy.priorityMedium}</option><option value="high">{copy.priorityHigh}</option><option value="critical">{copy.priorityCritical}</option>
                      </select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary" size="sm">{t.common.cancel}</Button>
                  </DialogClose>
                  <Button size="sm" onPress={() => void addTask("todo")} isDisabled={!newTaskTitle.trim()}>
                    {copy.createTask}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </Fade>

      {/* Board view */}
      {viewMode === "board" ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 pb-2" style={{ minWidth: "max-content" }}>
            {filteredColumns.map((col, i) => (
              <Fade key={col.id} delay={i * 60} initialY={6}>
                <BoardColumn
                  col={col}
                  selectedId={selectedId}
                  draggingTaskId={draggingTask}
                  dragOverColId={dragOverCol}
                  onSelectTask={setSelectedId}
                  onAddTask={() => { setNewTaskTitle(""); setDialogOpen(true); }}
                  onDragOver={handleColDragOver}
                  onDragLeave={handleColDragLeave}
                  onDrop={handleColDrop}
                  onCardDragStart={handleCardDragStart}
                  onCardDragEnd={handleCardDragEnd}
                  copy={copy}
                  locale={locale}
                />
              </Fade>
            ))}
          </div>
        </div>
      ) : (
        /* List view */
        <Fade delay={80}>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)]/60">
            <div className="grid grid-cols-[1fr_100px_100px_80px] gap-3 border-b border-[var(--border)]/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]/70">
              <span>{copy.listTask}</span><span>{copy.status}</span><span>{copy.priority}</span><span>{copy.listDue}</span>
            </div>
            {filteredColumns.flatMap((col) =>
              col.tasks.map((task) => {
                const prio = PRIO[task.priority] ?? PRIO.none;
                const sc = STATUS_MAP[task.status] ?? STATUS_MAP.todo;
                return (
                  <ViewTransition key={task.id}>
                    <button type="button"
                      onClick={() => setSelectedId(task.id === selectedId ? null : task.id)}
                      className={`grid w-full grid-cols-[1fr_100px_100px_80px] cursor-pointer items-center gap-3 border-b border-[var(--border)]/30 px-4 py-3 text-left transition-colors last:border-b-0
                        ${selectedId === task.id ? "bg-accent/5" : "hover:bg-[var(--surface-secondary)]/40"}`}>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${prio.dot}`} />
                        <span className="truncate text-sm font-medium">{task.title}</span>
                      </div>
                      <Chip size="sm" color={sc.color} variant="soft">{copy[sc.key]}</Chip>
                      <span className={`text-xs font-medium ${prio.color}`}>{copy[prio.key]}</span>
                      <span className="text-xs text-[var(--muted)]">{task.dueDate ? formatDueDate(task.dueDate, locale) : "—"}</span>
                    </button>
                  </ViewTransition>
                );
              })
            )}
          </div>
        </Fade>
      )}

      {/* Task detail slide-over */}
      <AnimatePresence>
        {selectedTask && (
          <>
            <motion.div
              key="detail-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-30 bg-black/0 lg:bg-transparent"
              onClick={() => setSelectedId(null)}
              aria-hidden
            />
            <TaskDetail task={selectedTask} onClose={() => setSelectedId(null)} copy={copy} locale={locale} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
