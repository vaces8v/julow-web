"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input, Text } from "@heroui/react";
import {
  Add01Icon,
  ArrowUpRight01Icon,
  UserGroupIcon,
} from "hugeicons-react";
import Link from "next/link";
import { motion } from "motion/react";
import { Fade } from "@/components/ui/fade";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import { useAuth } from "@/components/auth/auth-context";
import { api, type ProjectPayload } from "@/lib/api";
import { useI18n } from "@/i18n/context";

const isApiError = (e: unknown): e is { message: string } =>
  typeof e === "object" && e !== null && "message" in e;

const STATUS_BADGE: Record<string, { key: "statusActive" | "statusPaused" | "statusArchived" | "statusCompleted"; className: string }> = {
  active: { key: "statusActive", className: "bg-emerald-500/10 text-emerald-600" },
  paused: { key: "statusPaused", className: "bg-amber-500/10 text-amber-600" },
  archived: { key: "statusArchived", className: "bg-[var(--surface-secondary)] text-[var(--muted)]" },
  completed: { key: "statusCompleted", className: "bg-blue-500/10 text-blue-600" },
};

const FALLBACK_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#f97316", "#22c55e",
  "#ec4899", "#14b8a6", "#f59e0b", "#6366f1", "#ef4444",
];

function projectColor(project: ProjectPayload, idx: number) {
  if (project.color) return project.color;
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

export function ProjectsPage() {
  const { t } = useI18n();
  const copy = t.projects;
  /**
   * Используем единый источник истины из `WorkspaceShellContext`:
   * - `allProjects` — все проекты пользователя по всем воркспейсам
   *   (включая guest-membership от приглашений). Поэтому приглашённые
   *   проекты появляются на этой странице сразу, без переключения workspace.
   * - `workspaces` — для отображения имени workspace на карточке и в заголовках секций.
   * - `createProject` создаёт проект в `activeWorkspaceId` (это ок, новый
   *   появится в секции текущего workspace).
   */
  const { activeWorkspaceId, allProjects, workspaces, createProject } = useWorkspaceShell();
  /**
   * Нужно для фильтра задач: считаем только те задачи, где я «исполнитель»
   * (`assigneeIds` включает мой user.id). Прогресс-бар и summary выражают
   * МОЙ вклад, а не весь бэклог проекта.
   */
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const [taskCounts, setTaskCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /**
   * Подгружаем счётчики задач для прогресс-бара.
   *
   * Важно: `task.status` с бэка — это task LIFECYCLE (`active` / `archived` / …),
   * НЕ workflow-статус. Чтобы понять, выполнена ли задача, нужно посмотреть
   * `category` у workflow-статуса задачи (`statusId`). Категории бэка:
   * `todo | in_progress | review | done | cancelled | blocked`.
   *
   * Поэтому параллельно с `getTasks` тянем board-данные каждого проекта,
   * чтобы построить карту `status_id → category`, и считаем done только по
   * `category === "done"`. Если статусов нет (старые задачи без workflow) —
   * fallback на строку lifecycle, как было раньше.
   */
  /**
   * Подгружаем счётчики задач для КАЖДОГО проекта из `allProjects`,
   * включая cross-workspace. Нюансы:
   *  - `api.getTasks()` ходит в `GET /tasks/mine` — возвращает все задачи
   *    пользователя по всем воркспейсам, параметр workspaceId игнорируется
   *    (см. api.ts · `getTasks`).
   *  - `getBoardData(workspaceId, projectId)` требует ПРАВИЛЬНый workspaceId
   *    проекта — берём его из `project.workspaceId`, а не из активного.
   *    Иначе для guest-проектов был бы 404 / permission denied.
   */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (allProjects.length === 0) {
        setTaskCounts({});
        return;
      }
      const [allTasks, projectStatusMaps] = await Promise.all([
        api.getTasks(),
        Promise.all(
          allProjects.map(async (p) => {
            try {
              const { workflowStatuses } = await api.getBoardData(
                p.workspaceId,
                p.id,
              );
              const map: Record<string, string> = {};
              for (const ws of workflowStatuses) {
                map[ws.id] = ws.category.toLowerCase();
              }
              return [p.id, map] as const;
            } catch {
              return [p.id, {} as Record<string, string>] as const;
            }
          }),
        ),
      ]);
      if (cancelled) return;

      const statusCategoryByProject: Record<string, Record<string, string>> =
        Object.fromEntries(projectStatusMaps);

      const counts: Record<string, { total: number; done: number }> = {};
      for (const p of allProjects) {
        counts[p.id] = { total: 0, done: 0 };
      }
      const isDoneByLifecycle = (s: string) => {
        const l = s?.toLowerCase() ?? "";
        return l === "done" || l === "completed" || l === "closed";
      };
      for (const task of allTasks) {
        const entry = counts[task.projectId];
        if (!entry) continue;
        // Считаем только задачи, назначенные текущему пользователю.
        // Это показывает МОЙ прогресс по проекту, а не весь бэклог.
        // Если user.id пока не загружен — ничего не считаем.
        if (!currentUserId) continue;
        if (!task.assigneeIds.includes(currentUserId)) continue;
        entry.total++;
        const cat = task.statusId
          ? statusCategoryByProject[task.projectId]?.[task.statusId]
          : undefined;
        const isDone = cat === "done" || (!cat && isDoneByLifecycle(task.status));
        if (isDone) entry.done++;
      }
      if (!cancelled) setTaskCounts(counts);
    };
    void run();
    return () => { cancelled = true; };
  }, [allProjects, currentUserId]);

  const handleCreateProject = async () => {
    if (!activeWorkspaceId || !newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createProject({ name: newName, description: newDesc });
      setNewName("");
      setNewDesc("");
      setDialogOpen(false);
    } catch (err) {
      console.error("Failed to create project:", err);
      setCreateError(isApiError(err) ? err.message : copy.createFailed);
    } finally {
      setCreating(false);
    }
  };

  const totalTasks = Object.values(taskCounts).reduce((s, c) => s + c.total, 0);
  const totalDone = Object.values(taskCounts).reduce((s, c) => s + c.done, 0);
  const summary = copy.summary
    .replace("{{projects}}", String(allProjects.length))
    .replace("{{done}}", String(totalDone))
    .replace("{{tasks}}", String(totalTasks));

  /**
   * Группируем проекты по workspace:
   *  - сначала активный workspace (обычно «мои» проекты);
   *  - затем остальные (в которых я «гость» ввиду приглашения) —
   *    в отдельных секциях с именем workspace.
   * Сравнение идёт по workspaceId, порядок workspace'ов — стабильный (по
   * имени), чтобы не скакало при ререндерах.
   */
  const groupedProjects = useMemo(() => {
    const byWorkspace = new Map<string, ProjectPayload[]>();
    for (const p of allProjects) {
      const arr = byWorkspace.get(p.workspaceId) ?? [];
      arr.push(p);
      byWorkspace.set(p.workspaceId, arr);
    }
    // Сортируем проекты внутри каждого workspace по имени.
    for (const arr of byWorkspace.values()) {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    }

    const wsById = new Map(workspaces.map((w) => [w.id, w] as const));

    const active = byWorkspace.get(activeWorkspaceId) ?? [];
    // Разделяем guest-workspace'ы на две корзины:
    //  - known: всё есть в `workspaces` (реальное имя мы знаем) —
    //    рендерим отдельной секцией на каждый.
    //  - unknown: workspace не вернулся в `api.getWorkspaces()` (это бывает,
    //    когда приглашение даёт только project-level membership) —
    //    все такие проекты объединяем в ОДНУ общую секцию «Другие
    //    workspace», иначе бы каждый unknown ws рендерился отдельной
    //    секцией с одинаковым названием — визуальный шум.
    const knownGuestEntries: Array<{ workspace: NonNullable<ReturnType<typeof wsById.get>>; workspaceId: string; items: ProjectPayload[] }> = [];
    const unknownGuestProjects: ProjectPayload[] = [];
    for (const [wsId, items] of byWorkspace.entries()) {
      if (wsId === activeWorkspaceId) continue;
      const workspace = wsById.get(wsId);
      if (workspace) {
        knownGuestEntries.push({ workspace, workspaceId: wsId, items });
      } else {
        unknownGuestProjects.push(...items);
      }
    }
    knownGuestEntries.sort((a, b) => a.workspace.name.localeCompare(b.workspace.name));
    unknownGuestProjects.sort((a, b) => a.name.localeCompare(b.name));

    return {
      activeWorkspace: wsById.get(activeWorkspaceId),
      active,
      knownGuestEntries,
      unknownGuestProjects,
    };
  }, [allProjects, workspaces, activeWorkspaceId]);

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <Fade delay={0} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-tight">{copy.title}</h1>
          <Text color="muted" className="m-0 mt-1 text-sm">
            {summary}
          </Text>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Add01Icon size={14} />
              {copy.newProject}
            </Button>
          </DialogTrigger>
          <DialogContent from="top">
            <DialogHeader>
              <DialogTitle>{copy.createTitle}</DialogTitle>
              <DialogDescription>{copy.createDesc}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">{copy.name}</label>
                <Input
                  fullWidth
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={copy.namePlaceholder}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">{copy.description}</label>
                <textarea
                  className="min-h-[80px] resize-none rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-accent/60 focus:outline-none transition-colors"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={copy.descriptionPlaceholder}
                />
              </div>
              {createError && (
                <Text className="m-0 text-sm text-danger">{createError}</Text>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary" size="sm">{t.common.cancel}</Button>
              </DialogClose>
              <Button size="sm" onPress={handleCreateProject} isDisabled={creating || !newName.trim()}>
                {creating ? copy.creating : copy.createProject}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Fade>

      {/*
        Активный workspace: сначала заголовок (имя workspace), потом сетка
        карточек + «новый проект»-плейсхолдер. Создавать новые проекты можно
        только в активном workspace, поэтому плейсхолдер тоже здесь.
      */}
      <ProjectsSection
        title={
          groupedProjects.activeWorkspace
            ? copy.sectionMine.replace(
                "{{workspace}}",
                groupedProjects.activeWorkspace.name,
              )
            : copy.title
        }
        projects={groupedProjects.active}
        taskCounts={taskCounts}
        copy={copy}
        teamLabel={t.common.team}
        addPlaceholder
        onAddClick={() => setDialogOpen(true)}
        delayOffset={0}
      />

      {/*
        Known guest-workspaces: каждый — отдельная секция с реальным
        именем workspace в заголовке.
      */}
      {groupedProjects.knownGuestEntries.map((entry, idx) => (
        <ProjectsSection
          key={entry.workspaceId}
          title={entry.workspace.name}
          projects={entry.items}
          taskCounts={taskCounts}
          copy={copy}
          teamLabel={t.common.team}
          addPlaceholder={false}
          delayOffset={(idx + 1) * 30}
        />
      ))}

      {/*
        Unknown guest-workspaces ОБЪЕДИНЕНЫ в одну секцию: это
        проекты, к которым у пользователя project-level membership без
        workspace-level (типично после принятия инвайта). Иначе каждый бы
        рендерился своей секцией с одинаковым заголовком.
      */}
      {groupedProjects.unknownGuestProjects.length > 0 && (
        <ProjectsSection
          key="__unknown_workspaces__"
          title={t.shell.pinDialogSectionOtherWorkspace}
          projects={groupedProjects.unknownGuestProjects}
          taskCounts={taskCounts}
          copy={copy}
          teamLabel={t.common.team}
          addPlaceholder={false}
          delayOffset={(groupedProjects.knownGuestEntries.length + 1) * 30}
        />
      )}
    </div>
  );
}

// ── Section: workspace header + grid of project cards ─────────────────

/**
 * Секция со списком проектов одного workspace. Используется и для активного
 * workspace (с плейсхолдером «новый проект»), и для каждого гостевого
 * workspace (без плейсхолдера). Вынесено отдельным компонентом, чтобы
 * избежать дублирования мапы по карточкам и сделать DOM-вложенность
 * прозрачнее.
 */
function ProjectsSection({
  title,
  titleSubLabel,
  projects,
  taskCounts,
  copy,
  teamLabel,
  addPlaceholder,
  onAddClick,
  delayOffset,
}: {
  title: string;
  /** Маленький бейдж справа от названия секции (например, «Гость»). */
  titleSubLabel?: string;
  projects: ProjectPayload[];
  taskCounts: Record<string, { total: number; done: number }>;
  copy: {
    statusActive: string;
    statusPaused: string;
    statusArchived: string;
    statusCompleted: string;
    noDescription: string;
    tasksLine: string;
    openBoard: string;
    newProject: string;
  };
  teamLabel: string;
  addPlaceholder: boolean;
  onAddClick?: () => void;
  delayOffset: number;
}) {
  return (
    <div className="space-y-3">
      <Fade delay={delayOffset}>
        <div className="flex items-center gap-2">
          <h3 className="m-0 text-[13px] font-semibold">{title}</h3>
          {titleSubLabel && (
            <span className="rounded-full bg-[var(--surface-secondary)] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-[var(--muted)]">
              {titleSubLabel}
            </span>
          )}
          <span className="text-[11px] text-[var(--muted)]">· {projects.length}</span>
        </div>
      </Fade>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project, i) => (
          <ProjectCard
            key={project.id}
            project={project}
            idx={i}
            counts={taskCounts[project.id] ?? { total: 0, done: 0 }}
            copy={copy}
            teamLabel={teamLabel}
            delay={delayOffset + i * 70}
          />
        ))}

        {addPlaceholder && (
          <Fade delay={delayOffset + projects.length * 70} initialY={10}>
            <button
              type="button"
              onClick={onAddClick}
              className="flex min-h-[200px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)]/20 transition-colors hover:bg-[var(--surface-secondary)]/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-secondary)]">
                <Add01Icon size={18} strokeWidth={2} className="text-[var(--muted)]" />
              </div>
              <span className="text-sm font-medium text-[var(--muted)]">{copy.newProject}</span>
            </button>
          </Fade>
        )}
      </div>
    </div>
  );
}

// ── Single project card ────────────────────────────────────────────────

/**
 * Карточка проекта. Identична визуально предыдущему inline-рендеру, но
 * принимает явные пропы — это и есть «единица отображения» в обеих
 * секциях (своя/гостевые).
 */
function ProjectCard({
  project,
  idx,
  counts,
  copy,
  teamLabel,
  delay,
}: {
  project: ProjectPayload;
  idx: number;
  counts: { total: number; done: number };
  copy: {
    statusActive: string;
    statusPaused: string;
    statusArchived: string;
    statusCompleted: string;
    noDescription: string;
    tasksLine: string;
    openBoard: string;
  };
  teamLabel: string;
  delay: number;
}) {
  const pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
  const badge = STATUS_BADGE[project.status] ?? STATUS_BADGE.active;
  const color = projectColor(project, idx);
  const tasksLine = copy.tasksLine
    .replace("{{done}}", String(counts.done))
    .replace("{{total}}", String(counts.total));

  return (
    <Fade delay={delay} initialY={10}>
      <Link
        href={`/projects/${project.id}`}
        className="group block no-underline"
      >
        <div className="flex h-full flex-col rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border)] hover:shadow-md">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {project.icon ?? project.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="m-0 text-sm font-semibold">{project.name}</p>
                <span className="text-[11px] text-[var(--muted)]">{project.methodology}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{copy[badge.key]}</span>
              <ArrowUpRight01Icon size={14} strokeWidth={2} className="text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>

          <Text color="muted" className="m-0 mb-4 line-clamp-2 text-xs leading-relaxed">
            {project.description ?? copy.noDescription}
          </Text>

          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between">
              <Text color="muted" className="m-0 text-[11px]">{tasksLine}</Text>
              <span className="text-[11px] font-semibold" style={{ color }}>{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.2 + idx * 0.05 }}
              />
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between pt-3 border-t border-[var(--border)]/40">
            <div className="flex items-center gap-1">
              <UserGroupIcon size={12} strokeWidth={2} className="text-[var(--muted)]" />
              <Text color="muted" className="m-0 text-[11px]">{teamLabel}</Text>
            </div>
            <span className="text-[11px] font-medium" style={{ color }}>
              {copy.openBoard}
            </span>
          </div>
        </div>
      </Link>
    </Fade>
  );
}
