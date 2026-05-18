"use client";

/**
 * PinProjectDialog — выбор проекта для закрепления как таб.
 *
 * Использование: открывается из dropdown табов («Закрепить существующий»).
 * Показывает все проекты, доступные пользователю cross-workspace (источник
 * истины — `allProjects` из `useWorkspaceShell`), за исключением тех, что
 * уже открыты как табы. Группирует список на две секции:
 *   1. «В этом workspace» — проекты активного workspace.
 *   2. «Другие workspace» — проекты других workspace'ов (например,
 *      приглашения как GUEST в чужой workspace).
 *
 * При выборе проекта вызывается `onPin(project)`, который:
 *   - переключает активный workspace, если проект из другого;
 *   - удаляет проект из списка откреплённых (`julow_unpinned_tabs`),
 *     чтобы hydration-effect в AppShell снова добавил его как таб;
 *   - делает таб активным.
 *
 * Состояние закрепления сохраняется в localStorage и переживает
 * перезагрузку страницы.
 */

import * as React from "react";
import { Search01Icon, Folder02Icon, ArrowRight02Icon } from "hugeicons-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/context";
import type { ProjectPayload, WorkspacePayload } from "@/lib/api";

export interface PinProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Все проекты пользователя через все workspaces. */
  projects: ProjectPayload[];
  /** Все workspaces пользователя — для отображения имени группы. */
  workspaces: WorkspacePayload[];
  /** Активный workspace — для сортировки/группировки. */
  activeWorkspaceId: string;
  /** id'шники уже открытых табов — такие проекты не показываем. */
  openTabIds: string[];
  /** Колбэк выбора проекта. AppShell сам обновит unpinned + active. */
  onPin: (project: ProjectPayload) => void;
}

export function PinProjectDialog({
  open,
  onOpenChange,
  projects,
  workspaces,
  activeWorkspaceId,
  openTabIds,
  onPin,
}: PinProjectDialogProps) {
  const { t } = useI18n();
  const copy = t.shell;

  const [query, setQuery] = React.useState("");

  // Сброс поиска при каждом открытии — иначе старая строка останется
  // на следующий раз и непонятно, почему список пустой.
  React.useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Lookup `workspaceId → name`, чтобы не делать .find() в каждом рендере
  // элемента списка.
  const workspaceNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const w of workspaces) map.set(w.id, w.name);
    return map;
  }, [workspaces]);

  const openSet = React.useMemo(() => new Set(openTabIds), [openTabIds]);

  // Доступные для закрепления = всё, что не открыто.
  const available = React.useMemo(
    () => projects.filter((p) => !openSet.has(p.id)),
    [projects, openSet],
  );

  // Фильтрация по подстроке — case-insensitive, ищем по имени проекта
  // и по имени его workspace, чтобы можно было найти «Personal/My project»
  // или «Acme/Backend» одной строкой.
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      const wsName = workspaceNameById.get(p.workspaceId) ?? "";
      return wsName.toLowerCase().includes(q);
    });
  }, [available, query, workspaceNameById]);

  // Разбивка на «текущий workspace» / «остальные».
  const thisWs = React.useMemo(
    () => filtered.filter((p) => p.workspaceId === activeWorkspaceId),
    [filtered, activeWorkspaceId],
  );
  const otherWs = React.useMemo(
    () => filtered.filter((p) => p.workspaceId !== activeWorkspaceId),
    [filtered, activeWorkspaceId],
  );

  const handlePick = (project: ProjectPayload) => {
    onPin(project);
    onOpenChange(false);
  };

  const isEmpty = available.length === 0;
  const noResults = !isEmpty && filtered.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>{copy.pinDialogTitle}</DialogTitle>
          <DialogDescription>{copy.pinDialogSubtitle}</DialogDescription>
        </DialogHeader>

        {/* Search input — спрятан, если нет ни одного доступного проекта */}
        {!isEmpty && (
          <div className="px-6 pb-3">
            <label className="relative block">
              <Search01Icon
                size={14}
                strokeWidth={2}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={copy.pinDialogSearch}
                aria-label={copy.pinDialogSearch}
                autoFocus
                className="w-full rounded-xl border border-[var(--border)]/60 bg-[var(--field-background)] py-2 pl-9 pr-3 text-sm text-[var(--field-foreground)] placeholder:text-[var(--field-placeholder)] outline-none transition-colors focus:border-[var(--accent)]/60"
              />
            </label>
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto px-2 pb-4">
          {/* Все проекты уже как табы */}
          {isEmpty && (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              {copy.pinDialogEmpty}
            </p>
          )}

          {/* Есть проекты, но поиск ничего не нашёл */}
          {noResults && (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              {copy.pinDialogNoResults}
            </p>
          )}

          {/* Секция: проекты текущего workspace */}
          {thisWs.length > 0 && (
            <ProjectSection
              title={copy.pinDialogSectionThisWorkspace}
              projects={thisWs}
              workspaceNameById={workspaceNameById}
              showWorkspace={false}
              onPick={handlePick}
            />
          )}

          {/* Секция: проекты других workspace */}
          {otherWs.length > 0 && (
            <ProjectSection
              title={copy.pinDialogSectionOtherWorkspace}
              projects={otherWs}
              workspaceNameById={workspaceNameById}
              showWorkspace
              onPick={handlePick}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Внутренние компоненты ── */

interface ProjectSectionProps {
  title: string;
  projects: ProjectPayload[];
  workspaceNameById: Map<string, string>;
  /** Показывать ли подпись с именем workspace под проектом. */
  showWorkspace: boolean;
  onPick: (project: ProjectPayload) => void;
}

function ProjectSection({
  title,
  projects,
  workspaceNameById,
  showWorkspace,
  onPick,
}: ProjectSectionProps) {
  return (
    <div className="px-2 py-1">
      <p className="px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </p>
      <ul className="grid gap-0.5">
        {projects.map((project) => (
          <li key={project.id}>
            <ProjectRow
              project={project}
              workspaceName={
                showWorkspace
                  ? workspaceNameById.get(project.workspaceId) ?? ""
                  : ""
              }
              onPick={() => onPick(project)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ProjectRowProps {
  project: ProjectPayload;
  /** Пустая строка — workspace не показываем. */
  workspaceName: string;
  onPick: () => void;
}

function ProjectRow({ project, workspaceName, onPick }: ProjectRowProps) {
  const accent = project.color || "var(--accent)";
  return (
    <button
      type="button"
      onClick={onPick}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--surface-secondary)] focus:bg-[var(--surface-secondary)] focus:outline-none"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `color-mix(in oklch, ${accent} 15%, transparent)` }}
      >
        <Folder02Icon
          size={15}
          strokeWidth={1.8}
          style={{ color: accent }}
        />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium text-[var(--foreground)]">
          {project.name}
        </span>
        {workspaceName && (
          <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
            {workspaceName}
          </span>
        )}
      </span>
      <ArrowRight02Icon
        size={14}
        strokeWidth={1.8}
        className="shrink-0 text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}
