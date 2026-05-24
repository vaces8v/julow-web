"use client";

import { use, useCallback, useRef, useState, useEffect, startTransition, ViewTransition } from "react";
import { Badge, Button, Chip, Text } from "@heroui/react";
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  AttachmentIcon,
  Calendar01Icon,
  GridViewIcon,
  Menu01Icon,
  MoreHorizontalIcon,
  Remove01Icon,
  Search01Icon,
  Settings01Icon,
  TimelineIcon,
  UserGroupIcon,
} from "hugeicons-react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Fade } from "@/components/ui/fade";
import { AnimatePresence, motion } from "motion/react";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import {
  api,
  type TaskPayload,
  type ProjectPayload,
  type BoardColumnPayload,
  type WorkflowStatusPayload,
  type TaskDetailPayload,
  type CommentPayload,
} from "@/lib/api";
import { useI18n, type Locale } from "@/i18n/context";
import { FileTypeIcon } from "@/lib/file-icon";
import { useAuth } from "@/components/auth/auth-context";
import { TaskCreateDialog } from "@/components/task/task-create-dialog";
import { ProjectSettingsDialog } from "@/components/project/project-settings-dialog";
import { ProjectMembersDialog } from "@/components/project/project-members-dialog";

const COLUMN_MAX_H = "calc(100dvh - 200px)";

/** Человекочитаемый размер вложения комментария (B/KB/MB/GB). */
function formatAttachmentSize(bytes?: number): string {
  if (bytes == null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

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
  /** UUID workflow-статуса (status_id с бэкенда). */
  statusId?: string;
  labels: string[];
  dueDate?: string;
  startDate?: string;
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

/**
 * Определить колонку доски по workflow-статусу задачи.
 *
 * Приоритет:
 * 1. По `statusId` (UUID) → ищем в `workflowStatuses` → берём `category` → маппим в ключ колонки.
 * 2. Fallback по строке `status` (для задач без workflow-статуса).
 */
function resolveColumnKey(
  status: string,
  statusId: string | undefined,
  workflowStatuses: WorkflowStatusPayload[],
): string {
  // 1. Точный маппинг по UUID workflow-статуса.
  if (statusId) {
    const ws = workflowStatuses.find((s) => s.id === statusId);
    if (ws) {
      const cat = ws.category.toLowerCase();
      if (cat === "done") return "done";
      if (cat === "review") return "review";
      if (cat === "in_progress") return "in_progress";
      if (cat === "todo") return "todo";
      // Неизвестная категория — fallback ниже.
    }
  }
  // 2. Fallback по строке status (жизненный цикл: active/archived/deleted).
  const s = status?.toLowerCase() ?? "";
  if (s === "done" || s === "completed" || s === "closed") return "done";
  if (s === "review" || s === "in_review" || s === "in-review") return "review";
  if (s === "in_progress" || s === "in-progress") return "in_progress";
  // "active" — задача без workflow-статуса → todo (дефолт)
  return "todo";
}

/** Эвристики синтетический ключ → имя колонки на бэкенде (lower-cased). */
const COLUMN_KEY_KEYWORDS: Record<string, string[]> = {
  todo: ["todo", "to do", "to-do", "backlog", "open", "new"],
  in_progress: ["in progress", "in_progress", "in-progress", "doing", "active", "wip"],
  review: ["review", "in review", "qa", "testing"],
  done: ["done", "completed", "complete", "closed", "finished"],
};

/**
 * Fallback-цепочка категорий: если нет точного совпадения для ключа колонки,
 * пробуем родственные категории. Например, `review` — подмножество `in_progress`,
 * поэтому при отсутствии отдельного `REVIEW` workflow-статуса drop в «Review»
 * должен перевести задачу в «In Progress».
 */
const COLUMN_KEY_FALLBACK_CATEGORIES: Record<string, string[]> = {
  todo: ["todo"],
  in_progress: ["in_progress"],
  review: ["review", "in_progress"],
  done: ["done"],
};

/**
 * Найти `status_id` workflow-статуса для целевой synthetic-колонки.
 *
 * Стратегия (по приоритету):
 * 1. `workflowStatuses` — бэкенд отдаёт `category` (todo/in_progress/done/review…)
 *    для каждого workflow-статуса. Если категория совпадает с ключом колонки —
 *    берём этот статус. Если статусов с нужной категорией несколько, берём
 *    `isDefault`, иначе первый. Если точной категории нет, идём по fallback-цепочке.
 * 2. `boardColumns` — колонка может иметь `statusMapping` (UUID статуса).
 *    Сопоставляем по подстрокам в `column.name` (case-insensitive).
 * 3. Возвращает `null`, если ничего не найдено — DnD-хвостовой PATCH пропускается.
 */
function resolveStatusIdForKey(
  key: string,
  workflowStatuses: WorkflowStatusPayload[],
  boardColumns: BoardColumnPayload[],
): string | null {
  // 1. Пробуем категории по fallback-цепочке.
  const categories = COLUMN_KEY_FALLBACK_CATEGORIES[key] ?? [key];
  for (const cat of categories) {
    const matching = workflowStatuses.filter(
      (s) => s.category.toLowerCase() === cat.toLowerCase(),
    );
    if (matching.length > 0) {
      const def = matching.find((s) => s.isDefault);
      return (def ?? matching[0]).id;
    }
  }

  // 2. Fallback: эвристика по имени колонки + statusMapping.
  const kws = COLUMN_KEY_KEYWORDS[key] ?? [];
  for (const col of boardColumns) {
    if (!col.statusMapping) continue;
    const n = col.name.toLowerCase();
    if (kws.some((kw) => n.includes(kw))) return col.statusMapping;
  }
  return null;
}

function taskToBoardTask(t: TaskPayload): BoardTask {
  return {
    id: t.id,
    title: t.title,
    priority: (t.priority?.toLowerCase() ?? "none") as Priority,
    status: t.status,
    statusId: t.statusId,
    labels: t.labels,
    dueDate: t.dueDate,
    startDate: t.startDate,
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

function buildColumns(tasks: BoardTask[], workflowStatuses: WorkflowStatusPayload[]): Column[] {
  const map = new Map<string, BoardTask[]>();
  for (const t of tasks) {
    const key = resolveColumnKey(t.status, t.statusId, workflowStatuses);
    // Переопределяем `status` ключом колонки — иначе после reload бэкенд
    // отдаёт `status="active"` (жизненный цикл), и чип в TaskCard всегда
    // будет показывать "В работе" независимо от реальной колонки.
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ ...t, status: key });
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
      // Hover: едва заметное повышение яркости (bg + border), без сдвига вверх.
      // Переходы 200ms ease-out — мягкое появление.
      className={`group cursor-pointer select-none rounded-xl border
        transition-[background-color,border-color,box-shadow,transform,opacity] duration-200 ease-out
        ${isDragging ? "opacity-40 scale-[0.97]" : ""}
        ${isSelected
          ? "border-accent/60 bg-accent/5 shadow-sm shadow-accent/10"
          : "border-[var(--border)]/60 bg-[var(--surface)] hover:border-[var(--border)] hover:bg-[var(--surface-secondary)]/30 hover:shadow-sm"
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
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, colId: string) => void;
  onCardDragStart: (e: React.DragEvent, taskId: string) => void;
  onCardDragEnd: () => void;
  copy: ReturnType<typeof useI18n>["t"]["projects"];
  locale: Locale;
}) {
  const isDropTarget = dragOverColId === col.id && draggingTaskId !== null;

  return (
    <motion.div
      // Сама колонка: лёгкий slide-down при активации (4px) и микро-scale.
      // Базовый bg остаётся через Tailwind (без анимации) — это снимает
      // «дёргание» при пересечениях курсора. Подсветка drop-target вынесена
      // в отдельный absolute-overlay с AnimatePresence ниже — фреймер
      // плавно интерполирует opacity (color-mix-строки он не умеет).
      animate={{
        y: isDropTarget ? 4 : 0,
        scale: isDropTarget ? 1.005 : 1,
      }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex w-72 shrink-0 flex-col rounded-2xl border border-[var(--border)]/30 bg-[var(--surface-secondary)]/60 xl:w-80"
      onDragOver={(e) => onDragOver(e, col.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, col.id)}
    >
      {/* Drop-target overlay: плавный fade-in/out подсветки + рамки.
          Лежит поверх всего content, pointer-events-none чтобы не блочить DnD. */}
      <AnimatePresence>
        {isDropTarget && (
          <motion.div
            key="drop-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 rounded-2xl bg-accent/8 ring-2 ring-accent/35"
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-center gap-2 px-3 py-3">
        <span className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
        <span className="text-[13px] font-semibold">{copy[col.labelKey]}</span>
        <Badge size="sm" color="default" variant="soft" className="ml-1">{col.tasks.length}</Badge>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => onAddTask(col.id)}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--muted)] transition-colors duration-200 hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]">
            <Add01Icon size={13} strokeWidth={2.2} />
          </button>
          <button type="button"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--muted)] transition-colors duration-200 hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]">
            <MoreHorizontalIcon size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div
        className="relative overflow-y-auto px-2 pb-3 scrollbar-thin"
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
          {col.tasks.length === 0 && (
            // Единый placeholder для пустой колонки. Высота фиксированная (py-8),
            // меняется только цвет рамки/фона при drop-target — без скачков размера.
            <div
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8
                transition-[background-color,border-color] duration-200 ease-out
                ${isDropTarget
                  ? "border-accent/40 bg-accent/5"
                  : "border-[var(--border)]/60 bg-transparent"
                }`}
            >
              <Text color="muted" className="m-0 text-xs">{copy.noTasksYet}</Text>
              <button type="button" onClick={() => onAddTask(col.id)} className="text-xs text-accent hover:underline">
                {copy.addTask}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── ListSection ───────────────────────── */
/**
 * Секция в list-view. Каждая колонка статуса (todo/in_progress/review/done)
 * рендерится отдельной секцией: заголовок (точка, имя, бейдж со счётчиком),
 * затем строки задач. Реюзает те же drag-handler'ы, что и `BoardColumn`,
 * поэтому DnD работает кросс-секционно: тащим строку → дропаем на любую
 * другую секцию → задача меняет status_id через `handleColDrop`.
 */
function ListSection({
  col,
  selectedId,
  draggingTaskId,
  dragOverColId,
  onSelectTask,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
  onCardDragEnd,
  copy,
  locale,
}: {
  col: Column;
  selectedId: string | null;
  draggingTaskId: string | null;
  dragOverColId: string | null;
  onSelectTask: (id: string) => void;
  onDragOver: (e: React.DragEvent, colId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, colId: string) => void;
  onCardDragStart: (e: React.DragEvent, taskId: string) => void;
  onCardDragEnd: () => void;
  copy: ReturnType<typeof useI18n>["t"]["projects"];
  locale: Locale;
}) {
  const isDropTarget = dragOverColId === col.id && draggingTaskId !== null;

  return (
    <motion.div
      animate={{ scale: isDropTarget ? 1.005 : 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      onDragOver={(e) => onDragOver(e, col.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, col.id)}
      className="relative overflow-hidden rounded-2xl border border-[var(--border)]/30 bg-[var(--surface-secondary)]/40"
    >
      {/* Drop highlight overlay */}
      <AnimatePresence>
        {isDropTarget && (
          <motion.div
            key="list-drop-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 rounded-2xl bg-accent/8 ring-2 ring-accent/35"
          />
        )}
      </AnimatePresence>

      {/* Section header */}
      <div className="relative flex items-center gap-2 border-b border-[var(--border)]/40 bg-[var(--surface)]/40 px-4 py-2.5">
        <span className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
        <span className="text-[13px] font-semibold">{copy[col.labelKey]}</span>
        <Badge size="sm" color="default" variant="soft" className="ml-1">{col.tasks.length}</Badge>
      </div>

      {/* Column header (table) */}
      <div className="grid grid-cols-[1fr_100px_100px_80px] gap-3 border-b border-[var(--border)]/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]/70">
        <span>{copy.listTask}</span>
        <span>{copy.status}</span>
        <span>{copy.priority}</span>
        <span>{copy.listDue}</span>
      </div>

      {/* Rows */}
      {col.tasks.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-[var(--muted)]">
          {copy.noTasksYet}
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {col.tasks.map((task) => {
            const prio = PRIO[task.priority] ?? PRIO.none;
            const sc = STATUS_MAP[task.status] ?? STATUS_MAP.todo;
            const isDragging = draggingTaskId === task.id;
            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                draggable
                onDragStart={(e) => onCardDragStart(e as unknown as React.DragEvent, task.id)}
                onDragEnd={onCardDragEnd}
                onClick={() => onSelectTask(task.id)}
                className={`grid w-full cursor-pointer grid-cols-[1fr_100px_100px_80px] items-center gap-3 border-b border-[var(--border)]/30 px-4 py-3 text-left transition-colors last:border-b-0
                  ${isDragging ? "opacity-40" : ""}
                  ${selectedId === task.id ? "bg-accent/5" : "hover:bg-[var(--surface-secondary)]/40"}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${prio.dot}`} />
                  <span className="truncate text-sm font-medium">{task.title}</span>
                </div>
                <Chip size="sm" color={sc.color} variant="soft">{copy[sc.key]}</Chip>
                <span className={`text-xs font-medium ${prio.color}`}>{copy[prio.key]}</span>
                <span className="text-xs text-[var(--muted)]">{task.dueDate ? formatDueDate(task.dueDate, locale) : "—"}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

/* ── GanttView ─────────────────────────── */
/**
 * Диаграмма Ганта — третий режим отображения задач.
 *
 * Дизайн:
 *   - Заголовок в две строки: месяцы + диапазоны недель ("31 мар – 6 апр").
 *   - Левая колонка — иерархические подписи: `1. <Секция>` / `1.1 <Задача>`.
 *     Секции можно сворачивать (chevron слева).
 *   - Полосы задач — пастельные капсулы:
 *       high/critical → розовая (rose-200),
 *       остальные     → голубая (sky-200).
 *   - У каждой секции есть «парент-полоса» = union [min start, max end] её
 *     задач + ромб-milestone в конце.
 *   - Вертикальная пунктирная линия «Сегодня» + бейдж сверху.
 *   - Зум: −/+/100% (sticky top-right) меняет ширину одного дня.
 *
 * Без drag-and-drop (как в Board/List): Ганту нужен resize handler, что вне
 * scope текущей задачи. Клик по строке открывает task detail.
 */
const GANTT_BASE_DAY_W = 14; // px на 1 день @ 100% зума
const GANTT_LABEL_W = 260; // px ширина левой колонки с иерархической подписью
const GANTT_ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

/** Понедельник той же недели (ISO). */
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0 = Sun … 6 = Sat
  const shift = (dow + 6) % 7; // Mon → 0
  x.setDate(x.getDate() - shift);
  return x;
}

function formatWeekRange(start: Date, locale: Locale): string {
  const end = addDays(start, 6);
  const tag = locale === "ru" ? "ru-RU" : locale === "de" ? "de-DE" : "en-US";
  const fmtDayMonth = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" });
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()} – ${fmtDayMonth.format(end)}`;
  }
  return `${fmtDayMonth.format(start)} – ${fmtDayMonth.format(end)}`;
}

function GanttView({
  columns,
  loading,
  selectedId,
  onSelectTask,
  copy,
  locale,
}: {
  columns: Column[];
  loading: boolean;
  selectedId: string | null;
  onSelectTask: (id: string) => void;
  copy: ReturnType<typeof useI18n>["t"]["projects"];
  locale: Locale;
}) {
  const [zoom, setZoom] = useState<number>(1);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const dayW = GANTT_BASE_DAY_W * zoom;

  // Только непустые секции — пустые колонки на диаграмме лишь шумят.
  const sections = columns
    .map((c) => ({
      id: c.id,
      label: copy[c.labelKey],
      dotColor: c.dotColor,
      tasks: c.tasks,
    }))
    .filter((s) => s.tasks.length > 0);

  const totalTasks = sections.reduce((s, sec) => s + sec.tasks.length, 0);

  // Диапазон дат: min/max по всем задачам + поля по краям.
  const today = startOfDay(new Date());
  const allDates: Date[] = [];
  for (const sec of sections) {
    for (const t of sec.tasks) {
      const s = t.startDate ? startOfDay(new Date(t.startDate)) : null;
      const e = t.dueDate ? startOfDay(new Date(t.dueDate)) : null;
      if (s) allDates.push(s);
      if (e) allDates.push(e);
    }
  }
  let rangeStart: Date;
  let rangeEnd: Date;
  if (allDates.length === 0) {
    rangeStart = addDays(today, -14);
    rangeEnd = addDays(today, 42);
  } else {
    const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())));
    rangeStart = addDays(min, -7);
    rangeEnd = addDays(max, 14);
    // Сегодня всегда в диапазоне (контекст «где мы сейчас»).
    if (today < rangeStart) rangeStart = addDays(today, -7);
    if (today > rangeEnd) rangeEnd = addDays(today, 7);
  }
  // Выравниваем по границам недели (Пн ... Вс), чтобы ячейки заголовка были ровными.
  rangeStart = startOfWeek(rangeStart);
  rangeEnd = addDays(startOfWeek(rangeEnd), 6);

  const totalDays = daysBetween(rangeStart, rangeEnd) + 1;
  const timelineWidth = totalDays * dayW;

  // Недели — ячейки заголовка.
  const weeks: { start: Date; days: number; offsetDays: number }[] = [];
  for (let i = 0; i < totalDays; i += 7) {
    weeks.push({ start: addDays(rangeStart, i), days: 7, offsetDays: i });
  }

  // Месяцы — группируем дни по `month + year`.
  const monthGroups: { label: string; days: number; offsetDays: number }[] = [];
  {
    const fmt = new Intl.DateTimeFormat(
      locale === "ru" ? "ru-RU" : locale === "de" ? "de-DE" : "en-US",
      { month: "long", year: "numeric" },
    );
    let cur: { label: string; days: number; offsetDays: number } | null = null;
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(rangeStart, i);
      const label = fmt.format(d);
      if (!cur || cur.label !== label) {
        if (cur) monthGroups.push(cur);
        cur = { label, days: 1, offsetDays: i };
      } else {
        cur.days += 1;
      }
    }
    if (cur) monthGroups.push(cur);
  }

  const todayOffset = daysBetween(rangeStart, today);
  const todayInRange = todayOffset >= 0 && todayOffset < totalDays;

  const zoomIndex = GANTT_ZOOM_LEVELS.indexOf(zoom as typeof GANTT_ZOOM_LEVELS[number]);
  const canZoomOut = zoomIndex > 0;
  const canZoomIn = zoomIndex < GANTT_ZOOM_LEVELS.length - 1;

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-6">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-3">
              <div className="h-3 w-40 rounded bg-[var(--surface-secondary)]" />
              <div className="h-5 flex-1 rounded-full bg-[var(--surface-secondary)]/60" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (totalTasks === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] px-6 py-10 text-center text-sm text-[var(--muted)]">
        {copy.noTasksYet}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Zoom control */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-0.5 rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] p-1 shadow-sm">
          <button
            type="button"
            onClick={() => canZoomOut && setZoom(GANTT_ZOOM_LEVELS[zoomIndex - 1])}
            disabled={!canZoomOut}
            aria-label="Zoom out"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Remove01Icon size={14} strokeWidth={2} />
          </button>
          <span className="min-w-[42px] select-none text-center text-[11.5px] font-semibold tabular-nums text-[var(--foreground)]">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => canZoomIn && setZoom(GANTT_ZOOM_LEVELS[zoomIndex + 1])}
            disabled={!canZoomIn}
            aria-label="Zoom in"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Add01Icon size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <div style={{ minWidth: GANTT_LABEL_W + timelineWidth }}>
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-[var(--border)]/60 bg-[var(--surface)]">
              {/* Months row */}
              <div className="flex border-b border-[var(--border)]/40">
                <div
                  style={{ width: GANTT_LABEL_W }}
                  className="shrink-0 border-r border-[var(--border)]/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]/70"
                >
                  {copy.listTask}
                </div>
                <div className="flex" style={{ width: timelineWidth }}>
                  {monthGroups.map((m, idx) => (
                    <div
                      key={`${m.label}-${idx}`}
                      style={{ width: m.days * dayW }}
                      className="overflow-hidden border-r border-[var(--border)]/30 px-3 py-2.5 text-[12px] font-semibold capitalize text-[var(--foreground)] last:border-r-0"
                    >
                      <span className="truncate">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Weeks row */}
              <div className="flex">
                <div
                  style={{ width: GANTT_LABEL_W }}
                  className="shrink-0 border-r border-[var(--border)]/60"
                />
                <div className="flex" style={{ width: timelineWidth }}>
                  {weeks.map((w) => {
                    const isCur =
                      todayInRange &&
                      todayOffset >= w.offsetDays &&
                      todayOffset < w.offsetDays + w.days;
                    return (
                      <div
                        key={w.offsetDays}
                        style={{ width: w.days * dayW }}
                        className={`flex shrink-0 items-center justify-center overflow-hidden border-r border-[var(--border)]/20 px-1 py-1.5 text-[10.5px] last:border-r-0 ${
                          isCur ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted)]"
                        }`}
                      >
                        <span className="truncate">{formatWeekRange(w.start, locale)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="relative">
              {/* Background week grid */}
              <div
                className="pointer-events-none absolute inset-y-0 z-0 flex"
                style={{ left: GANTT_LABEL_W, width: timelineWidth }}
                aria-hidden
              >
                {weeks.map((w, i) => (
                  <div
                    key={i}
                    style={{ width: w.days * dayW }}
                    className="border-r border-[var(--border)]/15 last:border-r-0"
                  />
                ))}
              </div>

              {/* Today vertical dashed line */}
              {todayInRange && (
                <>
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 z-[2] w-0 border-l border-dashed border-blue-500/70 dark:border-blue-400/70"
                    style={{ left: GANTT_LABEL_W + (todayOffset + 0.5) * dayW }}
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute z-[3] -translate-x-1/2"
                    style={{ left: GANTT_LABEL_W + (todayOffset + 0.5) * dayW, top: 4 }}
                  >
                    <span className="inline-block rounded-md bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                      {locale === "ru" ? "Сегодня" : locale === "de" ? "Heute" : "Today"}
                    </span>
                  </div>
                </>
              )}

              {/* Sections */}
              {sections.map((sec, secIdx) => {
                const isCollapsed = !!collapsed[sec.id];
                const sectionNum = secIdx + 1;

                // Раньше тут считался секционный union [min start, max end]
                // для отрисовки агрегат-полосы в section-row. Полосу убрали
                // (см. ниже комментарий «Раньше здесь была…») — расчёты
                // тоже больше не нужны.

                return (
                  <div key={sec.id} className="relative">
                    {/* Section header row */}
                    <div className="relative flex border-b border-[var(--border)]/40 bg-[var(--surface-secondary)]/40">
                      <div
                        style={{ width: GANTT_LABEL_W }}
                        className="flex shrink-0 items-center gap-1.5 border-r border-[var(--border)]/60 px-2 py-2"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsed((p) => ({ ...p, [sec.id]: !isCollapsed }))
                          }
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                          aria-label={isCollapsed ? "Expand" : "Collapse"}
                        >
                          <ArrowRight01Icon
                            size={12}
                            strokeWidth={2.4}
                            className={`transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
                          />
                        </button>
                        <span className="truncate text-[12.5px] font-semibold text-[var(--foreground)]">
                          {sectionNum}. {sec.label}
                        </span>
                        <span className="ml-auto shrink-0 rounded-full bg-[var(--surface-secondary)] px-1.5 py-px text-[10px] font-medium text-[var(--muted)]">
                          {sec.tasks.length}
                        </span>
                      </div>

                      {/*
                        Раньше здесь была «секционная» агрегат-полоса
                        (длинный sky-ribbon + ромб-milestone) — union
                        диапазона дат всех задач секции. Пользователи
                        читали её как фейковую задачу, растянутую «через
                        всё название», и спрашивали «что это за индикатор
                        на ревью». Убрана — статус секции и так считывается
                        по названию секции, бейджу с числом задач и самим
                        полосам задач ниже. Сам пустой timeline-cell мы
                        ОСТАВЛЯЕМ, чтобы вертикальная сетка дней / линия
                        «Сегодня» проходили сквозь section-row без разрыва.
                      */}
                      <div
                        className="shrink-0"
                        style={{ width: timelineWidth, height: 36 }}
                      />
                    </div>

                    {/* Task rows (collapsible) */}
                    <AnimatePresence initial={false}>
                      {!isCollapsed &&
                        sec.tasks.map((task, tIdx) => {
                          const prio = PRIO[task.priority] ?? PRIO.none;
                          const isHigh =
                            task.priority === "critical" || task.priority === "high";

                          let start: Date | null = task.startDate
                            ? startOfDay(new Date(task.startDate))
                            : null;
                          let end: Date | null = task.dueDate
                            ? startOfDay(new Date(task.dueDate))
                            : null;
                          let hasDates = true;
                          if (start && !end) end = start;
                          if (end && !start) start = end;
                          if (!start || !end) {
                            start = today;
                            end = today;
                            hasDates = false;
                          }
                          if (end < start) end = start;

                          const offsetDays = Math.max(
                            0,
                            daysBetween(rangeStart, start),
                          );
                          const lengthDays = Math.max(1, daysBetween(start, end) + 1);
                          const isSelected = selectedId === task.id;

                          const barTheme = !hasDates
                            ? "bg-[var(--surface-secondary)] ring-[var(--border)] text-[var(--muted)]"
                            : isHigh
                            ? "bg-rose-200 ring-rose-300/70 text-rose-950 dark:bg-rose-400/30 dark:ring-rose-300/40 dark:text-rose-50"
                            : "bg-sky-200 ring-sky-300/70 text-sky-950 dark:bg-sky-400/30 dark:ring-sky-300/40 dark:text-sky-50";

                          return (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 36 }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                              className="overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => onSelectTask(task.id)}
                                className={`flex w-full border-b border-[var(--border)]/20 text-left transition-colors last:border-b-0 ${
                                  isSelected
                                    ? "bg-accent/5"
                                    : "hover:bg-[var(--surface-secondary)]/25"
                                }`}
                              >
                                {/* Label cell.
                                    Порядок: [приоритет-точка] [нумерация] [title].
                                    Точка перенесена в самое начало строки, чтобы
                                    приоритет читался моментально, до индекса и
                                    названия (по запросу: «индикатор в начале,
                                    перед названием»). */}
                                <div
                                  style={{ width: GANTT_LABEL_W }}
                                  className="flex shrink-0 items-center gap-2 border-r border-[var(--border)]/60 py-2 pl-9 pr-3"
                                >
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${prio.dot}`}
                                    aria-hidden
                                  />
                                  <span className="shrink-0 text-[11.5px] font-medium tabular-nums text-[var(--muted)]/80">
                                    {sectionNum}.{tIdx + 1}
                                  </span>
                                  <span className="truncate text-[12.5px] font-medium text-[var(--foreground)]">
                                    {task.title}
                                  </span>
                                </div>

                                {/* Bar cell */}
                                <div
                                  className="relative shrink-0"
                                  style={{ width: timelineWidth, height: 36 }}
                                >
                                  {(() => {
                                    const barLeft = offsetDays * dayW + 2;
                                    const barWidth = Math.max(8, lengthDays * dayW - 4);
                                    // Если внутри полосы хватает места (~60px+) —
                                    // рисуем title прямо в полосе, как раньше.
                                    // Иначе выводим title как отдельный inline-label
                                    // справа от полосы. Это решает кейс «1-2 дня»,
                                    // когда полоса 14–28px и название не помещалось.
                                    const titleFitsInside = barWidth > 60;
                                    return (
                                      <>
                                        <div
                                          className={`absolute top-1/2 flex -translate-y-1/2 items-center overflow-hidden rounded-[6px] px-2 text-[10.5px] font-medium ring-1 shadow-sm transition-shadow ${barTheme} ${
                                            isSelected ? "ring-2 ring-accent/70" : ""
                                          }`}
                                          style={{
                                            left: barLeft,
                                            width: barWidth,
                                            height: 20,
                                          }}
                                          title={`${task.title}${
                                            hasDates
                                              ? ` · ${formatDueDate(start.toISOString(), locale)} → ${formatDueDate(end.toISOString(), locale)}`
                                              : ""
                                          }`}
                                        >
                                          {titleFitsInside && (
                                            <span className="truncate">{task.title}</span>
                                          )}
                                        </div>
                                        {!titleFitsInside && (
                                          /* Внешний label справа от полосы. Pointer-events
                                             отключены — клик всё равно ловит родительский
                                             <button>, а так курсор/hover не «прыгают»
                                             между полосой и текстом. `max-w` ограничен
                                             до конца таймлайна, чтобы длинные названия
                                             не вылезали за scroll-границу. */
                                          <span
                                            aria-hidden
                                            className="pointer-events-none absolute top-1/2 -translate-y-1/2 truncate text-[11px] font-medium text-[var(--foreground)]/85"
                                            style={{
                                              left: barLeft + barWidth + 6,
                                              maxWidth: Math.max(
                                                40,
                                                timelineWidth - (barLeft + barWidth + 6) - 4,
                                              ),
                                            }}
                                          >
                                            {task.title}
                                          </span>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </button>
                            </motion.div>
                          );
                        })}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── TaskDetail slide-over ─────────────── */
/**
 * Slide-over с реальными данными задачи.
 *
 * Загружает параллельно: `getTask` (карточка с assignees/checklists),
 * `listComments` и `getTaskChangelog`. Все мутации (toggle item, add comment,
 * delete/archive) идут на бэкенд + локально патчат стейт без перезагрузки.
 *
 * Чек-листы и комменты управляются напрямую через бэкенд — UI оптимистичных
 * апдейтов нет (минимум кода): после успешного запроса перезапрашиваем
 * только тот срез, что менялся.
 */
function TaskDetail({
  task,
  onClose,
  onTaskDeleted,
  copy,
  locale,
}: {
  task: BoardTask;
  onClose: () => void;
  onTaskDeleted: (taskId: string) => void;
  copy: ReturnType<typeof useI18n>["t"]["projects"];
  locale: Locale;
}) {
  const prio = PRIO[task.priority] ?? PRIO.none;
  const statusInfo = STATUS_MAP[task.status] ?? STATUS_MAP.todo;
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  const [detail, setDetail] = useState<TaskDetailPayload | null>(null);
  const [comments, setComments] = useState<CommentPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentAttachments, setCommentAttachments] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);
  const [taskAttachmentBusy, setTaskAttachmentBusy] = useState(false);
  const commentAttachmentInputRef = useRef<HTMLInputElement>(null);
  const taskAttachmentInputRef = useRef<HTMLInputElement>(null);
  /**
   * Кэш `userId → email`. Заполняется лениво при появлении нового
   * UUID в assignees / комментариях. Это экономит запросы и позволяет
   * быстро рендерить уже известных пользователей. Если запрос упал —
   * в кэше остаётся `null`, и UI показывает короткий UUID-fallback.
   */
  const [userEmails, setUserEmails] = useState<Record<string, string | null>>({});
  const [wsMemberNames, setWsMemberNames] = useState<Record<string, string>>({});

  const { activeWorkspaceId } = useWorkspaceShell();

  // Load workspace member display names (enriched from Profile BC).
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    api.getWorkspaceMembers(activeWorkspaceId).then((members) => {
      if (cancelled) return;
      const names: Record<string, string> = {};
      for (const m of members) {
        if (m.displayName) names[m.userId] = m.displayName;
      }
      setWsMemberNames(names);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeWorkspaceId]);

  // Загружаем детали + комментарии при смене task.id (история убрана —
  // её показ перегружал слайд-овер и редко использовался)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getTask(task.id).catch(() => null),
      api.listComments("task", task.id).catch(() => [] as CommentPayload[]),
    ]).then(([d, c]) => {
      if (cancelled) return;
      setDetail(d);
      setComments(c);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [task.id]);

  /**
   * Подтягиваем email для всех уникальных user-id, что встречаются в
   * assignees и в авторах комментариев. Запрос делаем только если этого
   * id ещё нет в кэше — повторных вызовов на тот же UUID не будет.
   */
  useEffect(() => {
    const ids = new Set<string>();
    detail?.assigneeIds.forEach((id) => ids.add(id));
    comments.forEach((c) => ids.add(c.authorId));
    const missing = [...ids].filter((id) => !(id in userEmails));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        api
          .getUserById(id)
          .then((u) => [id, u.email] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((results) => {
      if (cancelled) return;
      setUserEmails((prev) => {
        const next = { ...prev };
        for (const [id, email] of results) next[id] = email;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [detail?.assigneeIds, comments, userEmails]);

  /** Человекочитаемая метка для user-id: displayName → email → короткий UUID. */
  const userLabel = (uid: string): string => wsMemberNames[uid] ?? userEmails[uid] ?? `${uid.slice(0, 8)}…`;

  const inferAttachmentType = (file: File): "image" | "video" | "file" => {
    const type = file.type.toLowerCase();
    if (type.startsWith("image/")) return "image";
    if (type.startsWith("video/")) return "video";
    return "file";
  };

  const isImageName = (name: string): boolean => /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name);
  const isVideoName = (name: string): boolean => /\.(mp4|mov|webm|mkv|avi)$/i.test(name);

  const addCommentAttachmentFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setCommentAttachments((prev) => [...prev, ...Array.from(files)]);
  };

  const removeCommentAttachment = (index: number) => {
    setCommentAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const refreshDetail = useCallback(() => {
    void api.getTask(task.id).then(setDetail).catch(() => { });
  }, [task.id]);

  const onToggleItem = async (checklistId: string, itemId: string) => {
    setBusyToggle(itemId);
    try {
      await api.toggleChecklistItem(task.id, checklistId, itemId);
      refreshDetail();
    } catch {
      // ignore — UI остаётся в исходном состоянии
    } finally {
      setBusyToggle(null);
    }
  };

  const onPostComment = async () => {
    const content = commentDraft.trim();
    if (!content && commentAttachments.length === 0) return;
    const attachmentsDraft = commentAttachments;
    setPosting(true);
    setCommentDraft("");
    setCommentAttachments([]);
    try {
      const newComment = await api.addComment({
        targetType: "task",
        targetId: task.id,
        content,
        contentFormat: "markdown",
      });
      let enrichedComment = newComment;
      for (const file of attachmentsDraft) {
        try {
          const added = await api.addCommentAttachment(
            newComment.id,
            file,
            inferAttachmentType(file),
          );
          enrichedComment = {
            ...enrichedComment,
            attachments: [...enrichedComment.attachments, added],
          };
        } catch {
          // ignore one-file failures and keep the rest of the comment
        }
      }
      setComments((prev) => [...prev, enrichedComment]);
      setCommentDraft("");
    } catch {
      setCommentDraft(content);
      setCommentAttachments(attachmentsDraft);
      // ignore
    } finally {
      setPosting(false);
    }
  };

  const onAddTaskAttachments = async (files: FileList | null) => {
    if (!files?.length || taskAttachmentBusy) return;
    setTaskAttachmentBusy(true);
    try {
      for (const file of Array.from(files)) {
        try {
          await api.addTaskAttachment(task.id, file);
        } catch {
          // ignore one-file failures and keep uploading the rest
        }
      }
      refreshDetail();
    } finally {
      setTaskAttachmentBusy(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm(copy.confirmDelete)) return;
    try {
      await api.deleteTask(task.id);
      onTaskDeleted(task.id);
    } catch {
      // ignore — оставляем задачу в UI; пользователь увидит, что ничего не изменилось
    }
  };

  return (
    <motion.aside
      key="task-detail"
      initial={{ x: 360, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 360, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 40 }}
      // `data-task-detail-panel` — маркер для click-outside-to-close
      // в `ProjectBoardPage`: листенер на `document.mousedown` смотрит,
      // упал ли клик ВНУТРЬ элемента с этим атрибутом, и если нет —
      // закрывает slide-over. Раньше для этого использовался невидимый
      // полноэкранный overlay div, который перехватывал ВСЕ клики (в т.ч.
      // клики по другим задачам в Gantt/List/Board), из-за чего открыть
      // другую задачу стоило двух кликов: первый закрывал overlay, второй
      // — наконец-то срабатывал на task-кнопке.
      data-task-detail-panel
      // `overflow-hidden` — страховка от horizontal-overflow внутри панели.
      // Привязки/карточки с длинными «неразрываемыми» именами файлов могут
      // распирать `max-w-[78%]` пузыря и визуально вылезать за правую
      // границу 360-px sheet'а — этот overflow обрезает такие выбросы.
      className="fixed right-0 top-0 z-40 flex h-dvh w-[360px] flex-col overflow-hidden border-l border-[var(--border)]/60 bg-[var(--surface)] shadow-2xl"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)]/60 px-5 py-4">
        <span className="text-sm font-semibold">{copy.taskDetail}</span>
        <button type="button" onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)]">
          ×
        </button>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="space-y-5 p-5">
          {/* Labels + title */}
          <div className="flex flex-wrap gap-1.5">
            {task.labels.map((l: string) => (
              <span key={l} className="rounded-full bg-[var(--surface-secondary)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                {l}
              </span>
            ))}
          </div>

          <h2 className="m-0 text-base font-bold leading-snug">{task.title}</h2>

          {/* Description */}
          {detail?.description && (
            <div>
              <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{copy.detailDescription}</p>
              <p className="m-0 whitespace-pre-wrap text-[13px] leading-relaxed">{detail.description}</p>
            </div>
          )}

          {/* Meta block */}
          <div className="divide-y divide-[var(--border)]/40 rounded-xl border border-[var(--border)]/60">
            {[
              { label: copy.priority, value: <span className={`flex items-center gap-1.5 text-sm font-medium ${prio.color}`}><span className={`h-2 w-2 rounded-full ${prio.dot}`} />{copy[prio.key]}</span> },
              { label: copy.status, value: <Chip size="sm" color={statusInfo.color} variant="soft">{copy[statusInfo.key]}</Chip> },
              ...(task.dueDate ? [{ label: copy.dueDate, value: <span className="text-sm">{formatDueDate(task.dueDate, locale)}</span> }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-xs text-[var(--muted)]">{label}</span>
                <div>{value}</div>
              </div>
            ))}
          </div>

          {/* Assignees */}
          <div>
            <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{copy.detailAssignees}</p>
            {detail && detail.assigneeIds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {detail.assigneeIds.map((uid) => (
                  <span
                    key={uid}
                    title={uid}
                    className="rounded-full bg-[var(--surface-secondary)] px-2.5 py-0.5 text-[11px] text-[var(--foreground)]"
                  >
                    {userLabel(uid)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="m-0 text-xs text-[var(--muted)]">{copy.detailNoAssignees}</p>
            )}
          </div>

          {/* Task attachments */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Files</p>
              <Button
                size="sm"
                variant="secondary"
                isIconOnly
                aria-label="Attach files"
                className="shrink-0"
                onPress={() => taskAttachmentInputRef.current?.click()}
                isDisabled={taskAttachmentBusy}
              >
                <AttachmentIcon size={16} strokeWidth={1.6} />
              </Button>
            </div>
            <input
              ref={taskAttachmentInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void onAddTaskAttachments(e.target.files);
                if (e.target) e.target.value = "";
              }}
            />
            {detail && detail.attachments.length > 0 ? (
              <div className="space-y-2.5">
                {detail.attachments.map((att) => {
                  const image = isImageName(att.filename);
                  const video = isVideoName(att.filename);
                  return (
                    <div key={att.fileId} className="rounded-xl border border-[var(--border)]/50 bg-[var(--surface-secondary)]/25 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[10px] font-bold uppercase text-[var(--muted)]">
                          {att.filename.split(".").pop()?.slice(0, 4) ?? "file"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate text-[12px] font-medium">{att.filename}</p>
                          <p className="m-0 text-[10px] text-[var(--muted)]">{att.sizeBytes} B</p>
                        </div>
                      </div>
                      {image ? (
                        <img
                          src={`/api/proxy/files/${att.fileId}/content`}
                          alt={att.filename}
                          className="mt-2 max-h-52 w-full rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : null}
                      {video ? (
                        <video
                          controls
                          className="mt-2 max-h-52 w-full rounded-lg bg-black"
                          src={`/api/proxy/files/${att.fileId}/content`}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : loading ? (
              <p className="m-0 text-xs text-[var(--muted)]">{copy.detailLoading}</p>
            ) : (
              <p className="m-0 text-xs text-[var(--muted)]">—</p>
            )}
          </div>

          {/* Checklists */}
          <div>
            <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{copy.detailChecklists}</p>
            {detail && detail.checklists.length > 0 ? (
              <div className="space-y-2.5">
                {detail.checklists.map((cl) => (
                  <div key={cl.id} className="rounded-lg border border-[var(--border)]/50 bg-[var(--surface-secondary)]/30 p-2.5">
                    <p className="m-0 mb-1.5 text-[12px] font-semibold">{cl.title}</p>
                    <ul className="m-0 list-none space-y-1 p-0">
                      {cl.items.map((it) => (
                        <li key={it.id} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={it.isChecked}
                            disabled={busyToggle === it.id}
                            onChange={() => void onToggleItem(cl.id, it.id)}
                            className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-accent disabled:opacity-50"
                          />
                          <span className={`flex-1 text-[12px] leading-snug ${it.isChecked ? "text-[var(--muted)] line-through" : ""}`}>
                            {it.text}
                          </span>
                        </li>
                      ))}
                      {cl.items.length === 0 && (
                        <li className="text-[11px] text-[var(--muted)]">—</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            ) : loading ? (
              <p className="m-0 text-xs text-[var(--muted)]">{copy.detailLoading}</p>
            ) : (
              <p className="m-0 text-xs text-[var(--muted)]">{copy.detailNoChecklists}</p>
            )}
          </div>

          {/* Comments — chat-style bubbles.
              Свои сообщения (currentUserId === authorId) выравнены вправо
              в акцентном bubble. Чужие — слева с инициалом-аватаром и именем.
              Время показано под bubble мелким шрифтом. */}
          <div>
            <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{copy.detailComments}</p>
            {comments.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0 min-w-0">
                <AnimatePresence initial={false}>
                  {comments.map((c) => {
                    const isOwn = currentUserId !== null && c.authorId === currentUserId;
                    const label = userLabel(c.authorId);
                    const initial = (label[0] ?? "?").toUpperCase();
                    const time = new Date(c.createdAt).toLocaleTimeString(
                      locale === "ru" ? "ru-RU" : locale === "de" ? "de-DE" : "en-US",
                      { hour: "2-digit", minute: "2-digit" },
                    );
                    return (
                      <motion.li
                        key={c.id}
                        layout
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className={`flex min-w-0 items-end gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
                      >
                        {/* Avatar (initial) — только для чужих */}
                        {!isOwn && (
                          <span
                            title={c.authorId}
                            className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent"
                          >
                            {initial}
                          </span>
                        )}
                        {/* Bubble. `min-w-0` обязателен: в flex-row ребёнок по
                            умолчанию получает `min-width: auto`, и длинное
                            "неразрываемое" имя файла (через `_`) распирало
                            пузырь шире `max-w-[78%]` — он вываливался за
                            пределы 360-px слайд-овера задачи. */}
                        <div className={`flex min-w-0 max-w-[78%] flex-col ${isOwn ? "items-end" : "items-start"}`}>
                          {!isOwn && (
                            <span className="mb-0.5 px-1 text-[10px] font-medium text-[var(--muted)]" title={c.authorId}>
                              {label}
                            </span>
                          )}
                          <div
                            // `min-w-0` + `overflow-hidden` нужны, чтобы
                            // длинные неразрываемые имена файлов в карточках
                            // вложений не распирали пузырь сверх max-w-78%.
                            className={`w-full min-w-0 overflow-hidden rounded-2xl px-3 py-1.5 text-[12.5px] leading-snug shadow-sm ${
                              isOwn
                                ? "rounded-br-md bg-accent text-white"
                                : "rounded-bl-md border border-[var(--border)]/40 bg-[var(--surface-secondary)]/50 text-[var(--foreground)]"
                            }`}
                          >
                            <p className="m-0 whitespace-pre-wrap break-words">{c.content}</p>
                            {c.attachments.length > 0 ? (
                              <div className="mt-1.5 space-y-1.5">
                                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                  {c.attachments.filter((a) => isImageName(a.name ?? a.fileId)).map((a) => (
                                    <a
                                      key={a.id}
                                      href={`/api/proxy/files/${a.fileId}/content`}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className="block overflow-hidden rounded-lg"
                                      title={a.name ?? undefined}
                                    >
                                      <img
                                        src={`/api/proxy/files/${a.fileId}/content`}
                                        alt={a.name ?? "attachment"}
                                        className="max-h-52 w-full rounded-lg object-cover"
                                        loading="lazy"
                                      />
                                    </a>
                                  ))}
                                </div>
                                {c.attachments.filter((a) => isVideoName(a.name ?? a.fileId)).map((a) => (
                                  <video
                                    key={a.id}
                                    controls
                                    src={`/api/proxy/files/${a.fileId}/content`}
                                    className="max-h-52 w-full rounded-lg bg-black"
                                  />
                                ))}
                                <div className="flex flex-col gap-1.5">
                                  {c.attachments
                                    .filter((a) => !isImageName(a.name ?? a.fileId) && !isVideoName(a.name ?? a.fileId))
                                    .map((a) => {
                                      // Имя бывает пустым/UUID-овым — оставляем
                                      // file-id как fallback, чтобы пользователь
                                      // мог скачать файл и не споткнуться о
                                      // карточку без подписи.
                                      const label = a.name?.trim() || a.fileId;
                                      const size = formatAttachmentSize(a.sizeBytes);
                                      return (
                                        <a
                                          key={a.id}
                                          href={`/api/proxy/files/${a.fileId}/content`}
                                          target="_blank"
                                          rel="noreferrer noopener"
                                          download={a.name || undefined}
                                          className={`flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left transition-colors ${
                                            isOwn
                                              ? "border-white/20 bg-white/10 hover:bg-white/20"
                                              : "border-[var(--border)]/60 bg-[var(--surface)] hover:bg-[var(--surface-secondary)]"
                                          }`}
                                          title={label}
                                        >
                                          <FileTypeIcon
                                            filename={a.name ?? undefined}
                                            className="h-9 w-9"
                                            iconSize={20}
                                            tone={isOwn ? "on-accent" : "default"}
                                          />
                                          <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[12.5px] font-medium leading-tight">
                                              {label}
                                            </span>
                                            {size ? (
                                              <span
                                                className={`block text-[10.5px] ${
                                                  isOwn ? "text-white/70" : "text-[var(--muted)]"
                                                }`}
                                              >
                                                {size}
                                              </span>
                                            ) : null}
                                          </span>
                                        </a>
                                      );
                                    })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                          <span className="mt-0.5 px-1 text-[10px] text-[var(--muted)]/80">{time}</span>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            ) : !loading && (
              <p className="m-0 text-xs text-[var(--muted)]">{copy.detailNoComments}</p>
            )}
            {commentAttachments.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {commentAttachments.map((file, index) => (
                  <button
                    key={`${file.name}-${file.lastModified}-${index}`}
                    type="button"
                    onClick={() => removeCommentAttachment(index)}
                    className="rounded-full border border-[var(--border)]/60 bg-[var(--surface-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:border-accent/40"
                  >
                    {file.name}
                  </button>
                ))}
              </div>
            ) : null}
            {/* Composer — Enter отправляет, Shift+Enter перенос строки */}
            <div className="mt-3 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-secondary)]/30 p-1.5 focus-within:border-accent/50">
              <input
                ref={commentAttachmentInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addCommentAttachmentFiles(e.target.files);
                  if (e.target) e.target.value = "";
                }}
              />
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  isIconOnly
                  aria-label="Attach files"
                  className="shrink-0"
                  onPress={() => commentAttachmentInputRef.current?.click()}
                  isDisabled={posting}
                >
                  <AttachmentIcon size={16} strokeWidth={1.6} />
                </Button>
                <textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if ((commentDraft.trim() || commentAttachments.length > 0) && !posting) void onPostComment();
                    }
                  }}
                  placeholder={copy.detailWriteComment}
                  rows={1}
                  className="max-h-32 min-h-[28px] w-full resize-none bg-transparent px-2 py-1 text-[12.5px] leading-snug outline-none placeholder:text-[var(--muted)]/70"
                />
                <button
                  type="button"
                  onClick={() => void onPostComment()}
                  disabled={(!commentDraft.trim() && commentAttachments.length === 0) || posting}
                  aria-label={copy.detailSendComment}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onPress={() => void onDelete()} className="flex-1 text-red-500 hover:bg-red-500/10">
              {copy.deleteTask}
            </Button>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

/* ── Skeletons ───────────────────────── */
/**
 * Скелетон одной карточки задачи.
 * Имитирует layout `TaskCard`: заголовок, две строки лейблов, нижний row.
 * Tailwind `animate-pulse` даёт мягкий shimmer без js-зависимостей.
 */
function SkeletonTaskCard() {
  return (
    <div className="rounded-xl border border-[var(--border)]/40 bg-[var(--surface)]/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[var(--surface-secondary)]" />
        <div className="h-3 w-3/4 rounded bg-[var(--surface-secondary)]" />
      </div>
      <div className="mb-3 flex gap-1.5">
        <div className="h-4 w-12 rounded-full bg-[var(--surface-secondary)]/70" />
        <div className="h-4 w-16 rounded-full bg-[var(--surface-secondary)]/70" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-3 w-12 rounded bg-[var(--surface-secondary)]/60" />
        <div className="h-3 w-8 rounded bg-[var(--surface-secondary)]/60" />
      </div>
    </div>
  );
}

/** Скелетон колонки доски — header + N карточек. */
function SkeletonBoardColumn({ taskCount = 3 }: { taskCount?: number }) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-2xl border border-[var(--border)]/30 bg-[var(--surface-secondary)]/60 xl:w-80 animate-pulse">
      <div className="flex items-center gap-2 px-3 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--surface-secondary)]" />
        <div className="h-3 w-20 rounded bg-[var(--surface-secondary)]" />
        <div className="ml-1 h-4 w-6 rounded-full bg-[var(--surface-secondary)]/70" />
      </div>
      <div className="grid gap-2 px-2 pb-3">
        {Array.from({ length: taskCount }).map((_, i) => (
          <SkeletonTaskCard key={i} />
        ))}
      </div>
    </div>
  );
}

/** Скелетон строки в list-view. */
function SkeletonListRow() {
  return (
    <div className="grid grid-cols-[1fr_100px_100px_80px] items-center gap-3 border-b border-[var(--border)]/30 px-4 py-3 last:border-b-0 animate-pulse">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[var(--surface-secondary)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--surface-secondary)]" />
      </div>
      <div className="h-5 w-16 rounded-full bg-[var(--surface-secondary)]/70" />
      <div className="h-3 w-12 rounded bg-[var(--surface-secondary)]/70" />
      <div className="h-3 w-10 rounded bg-[var(--surface-secondary)]/70" />
    </div>
  );
}

/* ── Main page ─────────────────────────── */
export function ProjectBoardPage({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);
  const { locale, t } = useI18n();
  const copy = t.projects;
  const {
    activeWorkspaceId,
    allProjects,
    setActiveWorkspaceId,
  } = useWorkspaceShell();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  /**
   * Deep-link через `?task=<id>` (например, из уведомлений). Когда задачи
   * загружены и среди них есть таск с этим id — открываем slide-over.
   */
  const taskQuery = searchParams?.get("task") ?? null;

  const [project, setProject] = useState<ProjectPayload | null>(null);
  /**
   * `isOwner` определяет, может ли текущий пользователь:
   *   - открыть «Настройки проекта» (кнопка-шестерёнка) и редактировать
   *     name/description/удалять проект;
   *   - видеть вкладку «Приглашения» в диалоге участников.
   * На бэке создатель проекта попадает в `project.owner_ids`, остальные
   * (приглашённые через email/link) — нет. Приглашённые `member`/`guest`
   * к шестерёнке доступа не получают.
   */
  const isOwner = !!user && !!project && project.ownerIds.includes(user.id);
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS);
  /**
   * Реальные board-колонки с бэкенда: `{ id, name, statusMapping, ... }`.
   * Нужны, чтобы при DnD передавать настоящий `status_id` в `api.updateTaskStatus`,
   * а не синтетический ключ (`"todo"`, `"in_progress"`, ...), который бэкенд не знает.
   */
  const [boardColumns, setBoardColumns] = useState<BoardColumnPayload[]>([]);
  /** Workflow-статусы с бэкенда — содержат `category` (todo/in_progress/done/review),
   *  по которой можно надёжно замаппить синтетический ключ колонки → UUID статуса. */
  const [workflowStatuses, setWorkflowStatuses] = useState<WorkflowStatusPayload[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"board" | "list" | "gantt">("board");
  /**
   * `loading` — true пока тянем project + tasks + boardData с бэкенда.
   * Используется для рендера skeleton-колонок/строк вместо пустой доски,
   * чтобы избежать «пустое → внезапно появилось» в UX при reload.
   */
  const [loading, setLoading] = useState(true);

  /**
   * Load project + tasks + real board columns.
   *
   * Алгоритм:
   *   1. Ищем проект по id в cross-workspace списке `allProjects`. Это
   *      нужно, потому что после приёма приглашения активный workspace
   *      может быть другим — проект находится в чужом workspace, куда
   *      пользователя добавили как GUEST.
   *   2. Если `allProjects` ещё пустой (первая загрузка), ждём — это
   *      обычная стартовая загрузка `WorkspaceShellProvider`.
   *   3. Если проект найден, но `activeWorkspaceId` не совпадает с его
   *      `workspaceId` — синхронизируем shell, чтобы сайдбар и табы
   *      открылись на правильном workspace.
   *   4. Если проект НЕ найден в списке моих проектов — значит у юзера
   *      нет к нему доступа: `notFound()` → 404.
   */
  useEffect(() => {
    if (allProjects.length === 0) {
      // Shell ещё не догрузился; держим скелетон.
      return;
    }
    const proj = allProjects.find((p) => p.id === id) ?? null;
    if (!proj) {
      // Прямая навигация на чужой проект — без скрытия за маршрутом.
      notFound();
    }
    if (proj.workspaceId && proj.workspaceId !== activeWorkspaceId) {
      // Не вызываем дальше — следующий tick effect перезапустится с
      // обновлённым `activeWorkspaceId` и загрузит данные.
      setActiveWorkspaceId(proj.workspaceId);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        setProject(proj);
        const [tasks, boardData] = await Promise.all([
          api.getProjectTasks(proj.workspaceId, proj.id),
          api
            .getBoardData(proj.workspaceId, proj.id)
            .catch(() => ({
              columns: [] as BoardColumnPayload[],
              workflowStatuses: [] as WorkflowStatusPayload[],
            })),
        ]);
        if (cancelled) return;
        setColumns(buildColumns(tasks.map(taskToBoardTask), boardData.workflowStatuses));
        setBoardColumns(boardData.columns);
        setWorkflowStatuses(boardData.workflowStatuses);
      } catch {
        // Задачи/board не загрузились — оставляем дефолтные пустые колонки.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [allProjects, activeWorkspaceId, id, setActiveWorkspaceId]);

  const allTasks = columns.flatMap((c) => c.tasks);
  const selectedTask = allTasks.find((t) => t.id === selectedId);

  /**
   * Auto-open task slide-over если в URL есть `?task=<id>` и эта задача
   * присутствует в загруженной доске. Срабатывает один раз после загрузки —
   * далее `selectedId` управляется кликом пользователя. Если query-параметр
   * указывает на задачу из другого проекта, ничего не происходит.
   */
  useEffect(() => {
    if (loading) return;
    if (!taskQuery) return;
    if (selectedId === taskQuery) return;
    if (allTasks.some((t) => t.id === taskQuery)) {
      setSelectedId(taskQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, taskQuery, allTasks.length]);

  /**
   * Click-outside-to-close для slide-over с деталями задачи.
   *
   * Раньше эту роль играл невидимый полноэкранный overlay div поверх
   * страницы (`fixed inset-0 z-30` с `onClick={() => setSelectedId(null)}`),
   * но он же создавал баг «два клика, чтобы открыть другую задачу»:
   * пока slide-over открыт (или ещё анимируется на exit ~150мс),
   * overlay перехватывал ЛЮБОЙ клик и просто закрывал панель — клик
   * до task-кнопки не доходил, и приходилось кликать ещё раз.
   *
   * Теперь overlay помечен `pointer-events-none` (см. JSX ниже), а
   * click-outside мы детектируем здесь, на `mousedown` уровня document.
   * Важно именно `mousedown`, а не `click`: оба события сидят в одном
   * макротаске пользовательского жеста, и React 18 батчит их setState'ы.
   * Когда пользователь кликает по другой task-кнопке:
   *   1) сначала прилетает наш `mousedown` → `setSelectedId(null)`;
   *   2) затем React-`onClick` task-кнопки → `setSelectedId(newId)`;
   * Результирующий стейт после батча — `newId`, и панель открывается
   * на ПЕРВОМ клике, а не на втором.
   *
   * Маркер `[data-task-detail-panel]` стоит на корне `TaskDetail`
   * (motion.aside). Если клик попал в саму панель — игнорируем.
   */
  useEffect(() => {
    if (!selectedId) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      // Клик внутри slide-over → не трогаем (внутренние действия,
      // редактирование заголовка, кнопки, скролл и т.п.).
      if (target.closest("[data-task-detail-panel]")) return;
      // Клик по диалогам/поповерам/сheet'ам поверх slide-over (например,
      // confirm-удаления, status-popover) — НЕ outside. У них всех есть
      // role-overlay; нам достаточно проверить, что это внутри `<dialog>` /
      // `[role="dialog"]` / `[data-radix-popper-content-wrapper]`.
      if (
        target.closest('[role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]')
      ) {
        return;
      }
      setSelectedId(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [selectedId]);

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

  /**
   * После успешного создания через `TaskCreateDialog` — вставляем задачу в
   * соответствующую колонку (по возвращённому `status`) без перезагрузки
   * всей доски. Если задача попала в неизвестную колонку — кладём в `todo`
   * как fallback.
   */
  const handleTaskCreated = (newTask: TaskPayload) => {
    const boardTask = taskToBoardTask(newTask);
    const colKey = resolveColumnKey(boardTask.status, boardTask.statusId, workflowStatuses);
    setColumns((prev) =>
      prev.map((c) =>
        c.id === colKey ? { ...c, tasks: [boardTask, ...c.tasks] } : c,
      ),
    );
    setSelectedId(boardTask.id);
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
    if (dragOverCol !== colId) setDragOverCol(colId);
  };

  /**
   * Очищаем dragOverCol только когда курсор реально вышел за пределы колонки.
   * Без проверки `relatedTarget` событие срабатывает при каждом пересечении
   * границы дочернего элемента (header → scroll → card) и колонка «дёргает»
   * подсветкой. Если `relatedTarget` всё ещё внутри `currentTarget` — игнор.
   */
  const handleColDragLeave = (e: React.DragEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDragOverCol(null);
  };

  const handleColDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    const taskId = draggingTask ?? e.dataTransfer.getData("text/plain");
    const srcColId = dragSourceColRef.current;
    if (!taskId || !srcColId || srcColId === targetColId) {
      setDraggingTask(null);
      setDragOverCol(null);
      return;
    }

    // Маппим synthetic-key целевой колонки → реальный workflow status_id.
    const targetStatusId = resolveStatusIdForKey(targetColId, workflowStatuses, boardColumns);

    // Optimistic update: перемещаем задачу в целевую колонку.
    startTransition(() => {
      setColumns((prev) => {
        const task = prev.find((c) => c.id === srcColId)?.tasks.find((t) => t.id === taskId);
        if (!task) return prev;
        return prev.map((c) => {
          if (c.id === srcColId) return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
          if (c.id === targetColId) return { ...c, tasks: [{ ...task, status: targetColId, statusId: targetStatusId ?? task.statusId }, ...c.tasks] };
          return c;
        });
      });
    });

    // Persist на бэкенде.
    // Success-toast НЕ показываем тут: бэкенд эмитит domain event → WS-нотификация
    // (`notification.created`) → app-shell сам покажет toast. Иначе будет два тоста.
    if (activeWorkspaceId && project && targetStatusId) {
      api.updateTaskStatus(taskId, targetStatusId).catch(() => {
        // Rollback: возвращаем задачу в исходную колонку.
        const srcStatusId = resolveStatusIdForKey(srcColId, workflowStatuses, boardColumns);
        setColumns((prev) => {
          const task = prev.find((c) => c.id === targetColId)?.tasks.find((t) => t.id === taskId);
          if (!task) return prev;
          return prev.map((c) => {
            if (c.id === targetColId) return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
            if (c.id === srcColId) return { ...c, tasks: [{ ...task, status: srcColId, statusId: srcStatusId ?? task.statusId }, ...c.tasks] };
            return c;
          });
        });
        toast.error(copy.statusSaveFailed);
      });
    } else if (activeWorkspaceId && project) {
      // Не удалось определить targetStatusId — откатываем.
      const srcStatusId = resolveStatusIdForKey(srcColId, workflowStatuses, boardColumns);
      setColumns((prev) => {
        const task = prev.find((c) => c.id === targetColId)?.tasks.find((t) => t.id === taskId);
        if (!task) return prev;
        return prev.map((c) => {
          if (c.id === targetColId) return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
          if (c.id === srcColId) return { ...c, tasks: [{ ...task, status: srcColId, statusId: srcStatusId ?? task.statusId }, ...c.tasks] };
          return c;
        });
      });
      toast.error(copy.statusSaveFailed);
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

          {/* Skeleton показываем пока `loading` ИЛИ когда `project` ещё не пришёл.
              Это убирает «вспышку UUID» при первом заходе на страницу: раньше до
              ответа `getProject` рендерился fallback `copy.boardFallbackTitle`
              с сырым `id` (UUID из URL), что выглядело как баг. */}
          {!project || loading ? (
            <div className="flex items-center gap-3" aria-busy="true" aria-label={copy.loadingTitle}>
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-[var(--surface-secondary)]" />
              <div className="space-y-1.5">
                <div className="h-5 w-44 animate-pulse rounded-md bg-[var(--surface-secondary)]" />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-secondary)]/70" />
                  <span className="text-[var(--muted)]/40">·</span>
                  <div className="h-3 w-14 animate-pulse rounded bg-[var(--surface-secondary)]/70" />
                  <div className="h-1.5 w-20 animate-pulse rounded-full bg-[var(--surface-secondary)]" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: color }}>
                {project.icon ?? project.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </div>
              <div>
                <h1 className="m-0 text-xl font-bold tracking-tight">
                  {project.name}
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
          )}

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
              <button type="button" onClick={() => setViewMode("gantt")}
                aria-label={copy.viewGantt}
                title={copy.viewGantt}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${viewMode === "gantt" ? "bg-accent/10 text-accent" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
                <TimelineIcon size={13} strokeWidth={1.8} />
              </button>
            </div>

            {/* New Task — full-featured react-hook-form + zod dialog */}
            <Button size="sm" onPress={() => setDialogOpen(true)} isDisabled={!project || !activeWorkspaceId}>
              <Add01Icon size={14} /> {copy.newTask}
            </Button>

            {/* Members management */}
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              disabled={!project || !activeWorkspaceId}
              title="Members"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UserGroupIcon size={16} strokeWidth={1.8} />
            </button>

            {/* Project settings (gear) — только владельцу проекта.
                Приглашённые `member`/`guest` не должны иметь возможности
                редактировать имя/описание/удалять проект, поэтому кнопка
                целиком скрыта (а не disabled, чтобы UI не намекал на
                возможность). Соответствующий диалог тоже рендерим
                только под этим же условием. */}
            {isOwner && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                disabled={!project || !activeWorkspaceId}
                title={copy.settings}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Settings01Icon size={16} strokeWidth={1.8} />
              </button>
            )}

            {project && activeWorkspaceId && (
              <TaskCreateDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                workspaceId={activeWorkspaceId}
                projectId={project.id}
                onCreated={handleTaskCreated}
              />
            )}
            {/* Диалог настроек рендерим только владельцу — так
                принципиально нельзя «открыть» его извне, даже из кода. */}
            {isOwner && project && activeWorkspaceId && (
              <ProjectSettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                workspaceId={activeWorkspaceId}
                project={project}
                onUpdated={(patch) =>
                  setProject((prev) => (prev ? { ...prev, ...patch } : prev))
                }
              />
            )}
            {project && activeWorkspaceId && (
              <ProjectMembersDialog
                open={membersOpen}
                onOpenChange={setMembersOpen}
                workspaceId={activeWorkspaceId}
                project={project}
              />
            )}
          </div>
        </div>
      </Fade>

      {/* Board view */}
      {viewMode === "board" ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 pb-2" style={{ minWidth: "max-content" }}>
            {loading ? (
              // Skeleton: 4 колонки с разным числом карточек, чтобы выглядело живо
              [3, 4, 2, 3].map((count, i) => (
                <SkeletonBoardColumn key={i} taskCount={count} />
              ))
            ) : (
              filteredColumns.map((col, i) => (
                <Fade key={col.id} delay={i * 60} initialY={6}>
                  <BoardColumn
                    col={col}
                    selectedId={selectedId}
                    draggingTaskId={draggingTask}
                    dragOverColId={dragOverCol}
                    onSelectTask={setSelectedId}
                    onAddTask={() => setDialogOpen(true)}
                    onDragOver={handleColDragOver}
                    onDragLeave={handleColDragLeave}
                    onDrop={handleColDrop}
                    onCardDragStart={handleCardDragStart}
                    onCardDragEnd={handleCardDragEnd}
                    copy={copy}
                    locale={locale}
                  />
                </Fade>
              ))
            )}
          </div>
        </div>
      ) : viewMode === "list" ? (
        /* List view — те же секции, что и в Board (todo/in_progress/review/done),
           но строками. Каждая строка draggable; drop на секцию переводит
           задачу в этот статус через те же `handleColDrop` / `handleCardDragStart`. */
        <Fade delay={80}>
          <div className="space-y-4">
            {loading ? (
              <div className="overflow-hidden rounded-2xl border border-[var(--border)]/60">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonListRow key={i} />)}
              </div>
            ) : (
              filteredColumns.map((col) => (
                <ListSection
                  key={col.id}
                  col={col}
                  selectedId={selectedId}
                  draggingTaskId={draggingTask}
                  dragOverColId={dragOverCol}
                  onSelectTask={(id) => setSelectedId(id === selectedId ? null : id)}
                  onDragOver={handleColDragOver}
                  onDragLeave={handleColDragLeave}
                  onDrop={handleColDrop}
                  onCardDragStart={handleCardDragStart}
                  onCardDragEnd={handleCardDragEnd}
                  copy={copy}
                  locale={locale}
                />
              ))
            )}
          </div>
        </Fade>
      ) : (
        /* Gantt view — горизонтальная диаграмма по дням.
           Каждая задача — строка с цветной полосой [startDate..dueDate].
           Если start/due отсутствуют, задача показана как точка на дате,
           которая известна, либо скрыта (см. GanttView). */
        <Fade delay={80}>
          <GanttView
            columns={filteredColumns}
            loading={loading}
            selectedId={selectedId}
            onSelectTask={(id) => setSelectedId(id === selectedId ? null : id)}
            copy={copy}
            locale={locale}
          />
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
              // `pointer-events-none` КРИТИЧЕН: раньше этот overlay
              // (`fixed inset-0 z-30`) перехватывал любой клик на странице,
              // пока slide-over открыт И ещё ~150мс во время exit-анимации
              // (AnimatePresence держит элемент в DOM до завершения exit).
              // Из-за этого клик по другой задаче в Gantt/List/Board
              // СНАЧАЛА закрывал текущий slide-over (через onClick overlay),
              // и только ВТОРОЙ клик доходил до task-кнопки.
              // Теперь overlay чисто визуальный (он и так bg-black/0 — без
              // дымки), а click-outside-to-close мы реализовали через
              // document.mousedown ниже (см. useEffect с
              // `[data-task-detail-panel]`).
              className="pointer-events-none fixed inset-0 z-30 bg-black/0 lg:bg-transparent"
              aria-hidden
            />
            <TaskDetail
              task={selectedTask}
              onClose={() => setSelectedId(null)}
              onTaskDeleted={(taskId) => {
                setColumns((prev) => prev.map((c) => ({
                  ...c,
                  tasks: c.tasks.filter((t) => t.id !== taskId),
                })));
                setSelectedId(null);
              }}
              copy={copy}
              locale={locale}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
