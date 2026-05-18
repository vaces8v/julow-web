"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Chip, ListBox, ListBoxItem, Select, Text } from "@heroui/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Delete02Icon,
  Edit02Icon,
  File02Icon,
  FileDownloadIcon,
  FolderOpenIcon,
  Folder02Icon,
  GridViewIcon,
  Menu01Icon,
  Search01Icon,
} from "hugeicons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/i18n/context";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import { api, type FilePayload, type FolderPayload, type ProjectPayload } from "@/lib/api";
import { FileTypeIcon } from "@/lib/file-icon";

type ViewMode = "grid" | "list";

type FileKindFilter = "all" | "image" | "video" | "document" | "spreadsheet" | "archive" | "other";
type FileSourceFilter = "all" | "project" | "chat" | "task" | "comment" | "storage" | "shared" | "private" | "locked";

type SortBy = "name" | "modified" | "size" | "author";
type SortDir = "asc" | "desc";

/**
 * Persistent UI-state документной страницы. Сохраняется в localStorage
 * scoped per workspace, чтобы пользователь возвращался к тому же фильтру
 * после переключения вкладок / релоада.
 *
 * `activeFolder` — спец-id:
 *   - "all"          → все файлы;
 *   - "proj:<id>"    → виртуальный фильтр по `project:<id>` (для проектов
 *                      без своей PROJECT-папки или когда юзер кликнул на
 *                      проект в сайдбаре);
 *   - "<folder-id>"  → реальная папка из `fs_folders`. Если папка имеет
 *                      `projectId`, фильтр расширяется тегом `project:<id>`.
 */
interface DocumentsState {
  activeFolder: string;
  fileKindFilter: FileKindFilter;
  sourceFilter: FileSourceFilter;
  viewMode: ViewMode;
  sortBy: SortBy;
  sortDir: SortDir;
}

const DEFAULT_STATE: DocumentsState = {
  activeFolder: "all",
  fileKindFilter: "all",
  sourceFilter: "all",
  viewMode: "list",
  sortBy: "modified",
  sortDir: "desc",
};

function documentsStateKey(workspaceId: string): string {
  return `julow:documents_state:${workspaceId}`;
}

function readPersistedState(workspaceId: string): DocumentsState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(documentsStateKey(workspaceId));
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<DocumentsState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

function writePersistedState(workspaceId: string, state: DocumentsState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(documentsStateKey(workspaceId), JSON.stringify(state));
  } catch {
    /* квота переполнена — игнорируем */
  }
}

/**
 * Поднимается по родителям папки и возвращает `projectId` ближайшего
 * PROJECT-фолдера. Нужен, чтобы при выборе подпапки проекта фильтр
 * правильно матчил файлы из чатов/задач этого же проекта по тегу
 * `project:<id>`, не зависимо от их физического расположения.
 */
function resolveProjectIdForFolder(
  folderId: string,
  folderById: Map<string, FolderPayload>,
): string | undefined {
  let cur: FolderPayload | undefined = folderById.get(folderId);
  let depth = 0;
  while (cur && depth < 50) {
    if (cur.projectId) return cur.projectId;
    if (!cur.parentFolderId) return undefined;
    cur = folderById.get(cur.parentFolderId);
    depth += 1;
  }
  return undefined;
}

/** UI-узел дерева папок: реальный folder.id или "all" (виртуальный корень). */
type FolderNode = {
  id: string;
  name: string;
  folderType: string;
  projectId?: string;
  projectName?: string;
  children: FolderNode[];
};

function resolveFileKind(file: FilePayload): Exclude<FileKindFilter, "all"> {
  const mime = file.mimeType.toLowerCase();
  const ext = (file.originalName || file.name).split(".").pop()?.toLowerCase() ?? "";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext)) return "image";
  if (mime.startsWith("video/") || ["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) return "video";
  if (["pdf", "doc", "docx", "txt", "rtf", "md", "odt"].includes(ext)) return "document";
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "spreadsheet";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  return "other";
}

function getFilePreviewSrc(file: FilePayload): string {
  return file.previewPath ? `/api/proxy${file.previewPath}` : `/api/proxy/files/${file.id}/content`;
}

function isPreviewable(file: FilePayload): boolean {
  const kind = resolveFileKind(file);
  return kind === "image" || kind === "video";
}

function resolveFileSource(file: FilePayload, folder?: FolderPayload): Exclude<FileSourceFilter, "all"> {
  const tags = new Set((file.tags ?? []).map((t) => t.name.toLowerCase()));
  if (tags.has("source:chat") || tags.has("source:message")) return "chat";
  if (tags.has("source:task")) return "task";
  if (tags.has("source:comment")) return "comment";
  if (file.isLocked) return "locked";
  if (file.isShared) return "shared";
  if (folder?.folderType?.toUpperCase() === "PROJECT" || !!folder?.projectId) return "project";
  if (folder) return "storage";
  return "private";
}

/** Построить дерево из плоского списка папок workspace. */
function buildFolderTree(folders: FolderPayload[], projects: ProjectPayload[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  const projectById = new Map(projects.map((p) => [p.id, p.name]));
  folders.forEach((f) => {
    byId.set(f.id, {
      id: f.id,
      name: f.name,
      folderType: f.folderType,
      projectId: f.projectId ?? undefined,
      projectName: f.projectId ? projectById.get(f.projectId) : undefined,
      children: [] as FolderNode[],
    });
  });
  const roots: FolderNode[] = [];
  folders.forEach((f) => {
    const node = byId.get(f.id)!;
    if (f.parentFolderId && byId.has(f.parentFolderId)) {
      byId.get(f.parentFolderId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

/** Извлечь расширение файла из имени для бейджа в UI. */
function fileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return "file";
  return name.slice(dot + 1).toLowerCase().slice(0, 4);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatRelative(iso?: string, locale: "en" | "ru" | "de" = "en"): string {
  if (!iso) return "—";
  const tag = locale === "ru" ? "ru-RU" : locale === "de" ? "de-DE" : "en-US";
  return new Date(iso).toLocaleDateString(tag, { month: "short", day: "numeric" });
}

/**
 * Преобразует hex-цвет (#RRGGBB или #RGB) в `rgba(...)` с указанной
 * прозрачностью. Возвращает `undefined` для нераспознанных строк —
 * в этом случае пусть применяется CSS-fallback на accent.
 */
function hexToRgba(hex: string | undefined, alpha: number): string | undefined {
  if (!hex) return undefined;
  const h = hex.trim().replace(/^#/, "");
  const long = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (long.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(long)) return undefined;
  const r = parseInt(long.slice(0, 2), 16);
  const g = parseInt(long.slice(2, 4), 16);
  const b = parseInt(long.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function FolderTreeItem({
  node,
  depth = 0,
  active,
  isProjectNode = false,
  projectColor,
  onSelect,
  onContextMenu,
}: {
  node: FolderNode;
  depth?: number;
  active: string;
  isProjectNode?: boolean;
  /**
   * Цвет проекта (если задан) — применяется к иконке и фоновой
   * подсветке активного состояния, чтобы визуально соответствовать
   * табам проектов в шапке (app-shell.tsx).
   */
  projectColor?: string;
  onSelect: (id: string) => void;
  /**
   * Right-click обработчик — открывает context menu для папки
   * (Переименовать / Удалить). Опционален — если не задан,
   * правый клик откроет системное меню браузера.
   */
  onContextMenu?: (e: React.MouseEvent, id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = !!node.children?.length;
  const isActive = active === node.id;
  const isProjectFolder = isProjectNode || node.folderType?.toUpperCase() === "PROJECT" || !!node.projectName;
  const label = node.projectName || node.name;
  // Цвет применяется только к узлам, которые относятся к проекту:
  // корневой PROJECT-folder и его потомки наследуют `projectColor`.
  const effectiveColor = isProjectFolder ? projectColor : undefined;
  const activeStyle: React.CSSProperties | undefined =
    isActive && effectiveColor
      ? { backgroundColor: hexToRgba(effectiveColor, 0.14), color: effectiveColor }
      : undefined;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelect(node.id);
          if (hasChildren) setOpen((v) => !v);
        }}
        onContextMenu={(e) => onContextMenu?.(e, node.id, label)}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors ${
          isActive
            ? effectiveColor
              ? "font-medium"
              : "bg-accent/10 text-accent font-medium"
            : "text-muted hover:bg-[var(--surface-secondary)] hover:text-foreground"
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px`, ...activeStyle }}
      >
        {hasChildren ? (
          open ? (
            <FolderOpenIcon
              size={14}
              strokeWidth={1.8}
              className={`shrink-0 ${isProjectFolder && !effectiveColor ? "text-blue-500" : ""}`}
              style={effectiveColor ? { color: effectiveColor } : undefined}
            />
          ) : (
            <Folder02Icon
              size={14}
              strokeWidth={1.8}
              className={`shrink-0 ${isProjectFolder && !effectiveColor ? "text-blue-500" : ""}`}
              style={effectiveColor ? { color: effectiveColor } : undefined}
            />
          )
        ) : (
          <Folder02Icon
            size={14}
            strokeWidth={1.8}
            className={`shrink-0 opacity-60 ${isProjectFolder && !effectiveColor ? "text-blue-500 opacity-100" : ""}`}
            style={effectiveColor ? { color: effectiveColor, opacity: 1 } : undefined}
          />
        )}
        <span className="truncate">{label}</span>
      </button>
      {hasChildren && open &&
        node.children!.map((child) => (
          <FolderTreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            active={active}
            isProjectNode={isProjectFolder}
            projectColor={effectiveColor}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
          />
        ))}
    </div>
  );
}

/**
 * Простой select-фильтр над HeroUI Select + ListBox. Отдаёт выбранный
 * `value` родителю через `onChange`.
 */
function FilterSelect<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: Array<{ value: V; label: string }>;
  onChange: (v: V) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Select
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key != null) onChange(String(key) as V);
      }}
      className="flex items-center gap-2"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted/70">
        {label}
      </span>
      <Select.Trigger className="flex h-8 items-center gap-2 rounded-lg border border-[var(--border)]/60 bg-transparent px-3 text-xs font-medium text-foreground transition-colors hover:bg-[var(--surface-secondary)] focus:outline-none focus-visible:border-accent/50">
        <Select.Value className="truncate">{current?.label}</Select.Value>
        <ArrowDown01Icon size={12} strokeWidth={2} className="opacity-60" />
      </Select.Trigger>
      <Select.Popover className="z-50 min-w-[var(--trigger-width)] rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] p-1 shadow-lg">
        <ListBox className="max-h-64 overflow-auto outline-none">
          {options.map((opt) => (
            <ListBoxItem
              key={opt.value}
              id={opt.value}
              textValue={opt.label}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground outline-none hover:bg-[var(--surface-secondary)] data-[selected]:bg-accent/10 data-[selected]:text-accent"
            >
              {opt.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function DocumentsPage() {
  const { t, locale } = useI18n();
  const doc = t.documents;
  const { activeWorkspaceId, allProjects } = useWorkspaceShell();

  // ── Persisted UI state ───────────────────────────────────────
  // Все настройки UI (активная папка, фильтры, режим просмотра,
  // сортировка) сохраняются в localStorage scoped per workspace,
  // чтобы юзер возвращался к тем же фильтрам после смены вкладки
  // или перезагрузки.
  const [viewMode, setViewMode] = useState<ViewMode>(DEFAULT_STATE.viewMode);
  const [activeFolder, setActiveFolder] = useState<string>(DEFAULT_STATE.activeFolder);
  const [query, setQuery] = useState("");
  const [fileKindFilter, setFileKindFilter] = useState<FileKindFilter>(DEFAULT_STATE.fileKindFilter);
  const [sourceFilter, setSourceFilter] = useState<FileSourceFilter>(DEFAULT_STATE.sourceFilter);
  const [sortBy, setSortBy] = useState<SortBy>(DEFAULT_STATE.sortBy);
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_STATE.sortDir);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Modal/context-menu state ────────────────────────────────
  /** Create-folder modal. */
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderName, setCreateFolderName] = useState("");
  /** Rename modal — общий для файла и папки. */
  const [renameTarget, setRenameTarget] = useState<
    { kind: "file" | "folder"; id: string; name: string } | null
  >(null);
  const [renameName, setRenameName] = useState("");
  /** Delete-confirm modal — общий для файла и папки. */
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: "file" | "folder"; id: string; name: string } | null
  >(null);
  const [deletingInFlight, setDeletingInFlight] = useState(false);
  /**
   * Контекстное меню (правый клик). Хранит координаты виртуального
   * anchor'а в viewport-системе. Закрывается на любой click outside,
   * Esc, scroll или resize. Рендерится через `createPortal` в `body`,
   * чтобы не упираться в `overflow: hidden` родителей.
   */
  const [contextMenu, setContextMenu] = useState<
    { x: number; y: number; kind: "file" | "folder"; id: string; name: string } | null
  >(null);

  /**
   * При смене workspace — подгружаем сохранённое состояние из
   * localStorage. Сбрасываем `selected` (выбор файлов не должен
   * протекать между workspace'ами) и `query` (поиск тоже).
   *
   * Это «sync from external store» паттерн — мы синхронизируем
   * локальный стейт с внешним хранилищем (localStorage) при смене
   * ключа. ESLint react-hooks/set-state-in-effect жалуется на это,
   * но альтернатива (lazy init через useState) не работает: при
   * первом рендере workspaceId ещё неизвестен, и мы не можем
   * предсказать ключ. Поэтому отключаем правило точечно.
   */
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const persisted = readPersistedState(activeWorkspaceId);
    /* eslint-disable react-hooks/set-state-in-effect */
    setActiveFolder(persisted.activeFolder);
    setFileKindFilter(persisted.fileKindFilter);
    setSourceFilter(persisted.sourceFilter);
    setViewMode(persisted.viewMode);
    setSortBy(persisted.sortBy);
    setSortDir(persisted.sortDir);
    setSelected(new Set());
    setQuery("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeWorkspaceId]);

  /**
   * Любое изменение в постоянной части стейта пишется обратно в
   * localStorage. Сам `query`/`selected` намеренно не сохраняем —
   * поиск ad-hoc, выбор файлов одноразовый.
   */
  useEffect(() => {
    if (!activeWorkspaceId) return;
    writePersistedState(activeWorkspaceId, {
      activeFolder,
      fileKindFilter,
      sourceFilter,
      viewMode,
      sortBy,
      sortDir,
    });
  }, [activeWorkspaceId, activeFolder, fileKindFilter, sourceFilter, viewMode, sortBy, sortDir]);

  const [folders, setFolders] = useState<FolderPayload[]>([]);
  const [files, setFiles] = useState<FilePayload[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /**
   * Map: userId → читабельный лейбл (display name либо email). Заполняется
   * сначала из `getWorkspaceMembers` (быстро и батчем), а для авторов,
   * которых там нет — добивается через `getUserById` (email).
   * Используется в колонке "Author" вместо сырого UUID.
   */
  const [authorById, setAuthorById] = useState<Record<string, string>>({});
  const authorFetchedRef = useRef<Set<string>>(new Set());

  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const tree = useMemo(() => buildFolderTree(folders, allProjects), [folders, allProjects]);

  /**
   * Map: projectId → PROJECT-folder. Заполняется только из тех folders,
   * у которых одновременно `folderType="PROJECT"` и есть `projectId`.
   * Используется в сайдбаре для нахождения «корневой» папки проекта
   * (если она есть) при рендере проектов как раскрываемых узлов.
   */
  const projectFolderByProjectId = useMemo(() => {
    const map = new Map<string, FolderPayload>();
    folders.forEach((f) => {
      if (f.projectId && f.folderType?.toUpperCase() === "PROJECT") {
        map.set(f.projectId, f);
      }
    });
    return map;
  }, [folders]);

  /**
   * Корневые узлы, которые НЕ относятся к проектам — их рендерим в
   * отдельной секции «Папки», чтобы не дублировать проекты, уже
   * показанные в секции «Проекты».
   */
  const nonProjectRoots = useMemo(
    () =>
      tree.filter(
        (n) => !n.projectId && n.folderType?.toUpperCase() !== "PROJECT",
      ),
    [tree],
  );

  /**
   * Map: folderId → Set<folderId>, где значения — сама папка и все её
   * потомки. Нужен, чтобы при выборе родительского (например, project-)
   * фолдера в сайдбаре в правой панели сразу было видно файлы из всех
   * подпапок проекта, а не только лежащие непосредственно в его корне.
   */
  const folderDescendants = useMemo(() => {
    const childrenByParent = new Map<string, string[]>();
    folders.forEach((f) => {
      const key = f.parentFolderId ?? "";
      const list = childrenByParent.get(key) ?? [];
      list.push(f.id);
      childrenByParent.set(key, list);
    });
    const map = new Map<string, Set<string>>();
    folders.forEach((f) => {
      const set = new Set<string>();
      const stack = [f.id];
      while (stack.length) {
        const id = stack.pop()!;
        if (set.has(id)) continue;
        set.add(id);
        (childrenByParent.get(id) ?? []).forEach((child) => stack.push(child));
      }
      map.set(f.id, set);
    });
    return map;
  }, [folders]);

  // Загрузка папок + всех файлов workspace
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    Promise.all([
      api.listFolders(activeWorkspaceId).catch(() => [] as FolderPayload[]),
      api.listWorkspaceFiles(activeWorkspaceId).catch(() => [] as FilePayload[]),
    ]).then(([folderList, fileList]) => {
      if (cancelled) return;
      setFolders(folderList);
      setFiles(fileList);
    });
    return () => { cancelled = true; };
  }, [activeWorkspaceId, refreshKey]);

  /**
   * Преднаполняем `authorById` по списку участников workspace —
   * для большинства файлов uploader входит в workspace, поэтому
   * один пагинированный запрос экономит N точечных getUserById.
   */
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    api
      .getWorkspaceMembers(activeWorkspaceId)
      .then((members) => {
        if (cancelled) return;
        setAuthorById((prev) => {
          const next = { ...prev };
          for (const m of members) {
            if (!next[m.userId] && m.displayName) next[m.userId] = m.displayName;
          }
          return next;
        });
      })
      .catch(() => {
        /* пользователь без прав на список участников — fallback на getUserById */
      });
    return () => { cancelled = true; };
  }, [activeWorkspaceId]);

  /**
   * Для uploader'ов, которые не пришли в `getWorkspaceMembers` (гости,
   * приглашённые из чужого workspace, удалённые из workspace и т.п.),
   * добиваем email через Identity BC. Кешируем `authorFetchedRef`,
   * чтобы не дёргать API повторно при каждом ре-рендере.
   */
  useEffect(() => {
    const needed = new Set<string>();
    files.forEach((f) => {
      if (!f.uploaderId) return;
      if (authorById[f.uploaderId]) return;
      if (authorFetchedRef.current.has(f.uploaderId)) return;
      needed.add(f.uploaderId);
    });
    if (needed.size === 0) return;
    needed.forEach((userId) => {
      authorFetchedRef.current.add(userId);
      api
        .getUserById(userId)
        .then((u) => {
          setAuthorById((prev) => (prev[userId] ? prev : { ...prev, [userId]: u.email }));
        })
        .catch(() => {
          /* недоступный пользователь — оставим UUID-обрезок ниже */
        });
    });
  }, [files, authorById]);

  /** Лейбл для колонки "Author": имя → email → короткий UUID. */
  const authorLabel = (uploaderId: string): string =>
    authorById[uploaderId] ?? `${uploaderId.slice(0, 8)}…`;

  /**
   * Резолв активной «области видимости» (scope) из `activeFolder`.
   * Поддерживает три кейса:
   *   - `"all"`                 → нет folder/project ограничения;
   *   - `"proj:<projectId>"`    → виртуальный проект-фильтр;
   *   - `"<folderId>"`          → реальная папка (плюс попытка достать
   *                                projectId через ancestors, чтобы
   *                                файлы из чатов/задач того же
   *                                проекта тоже попадали в выборку).
   */
  const activeScope = useMemo(() => {
    if (activeFolder === "all") return { kind: "all" as const };
    if (activeFolder.startsWith("proj:")) {
      return { kind: "project" as const, projectId: activeFolder.slice(5) };
    }
    // Иначе считаем, что это folder.id. Folder может быть подпапкой
    // проекта — берём projectId ближайшего PROJECT-предка.
    const projectId = resolveProjectIdForFolder(activeFolder, folderById);
    const allowedFolderIds = folderDescendants.get(activeFolder);
    return {
      kind: "folder" as const,
      folderId: activeFolder,
      projectId,
      allowedFolderIds,
    };
  }, [activeFolder, folderById, folderDescendants]);

  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = files.filter((f) => {
      // ── folder/project область видимости ────────────────────
      let matchScope = true;
      if (activeScope.kind === "project") {
        const tags = new Set((f.tags ?? []).map((t) => t.name.toLowerCase()));
        const tagMatch = tags.has(`project:${activeScope.projectId}`);
        // Поддержим и обычные файлы, лежащие в любой папке этого
        // проекта (даже если бэк не проставил project:<id> тег —
        // например, на этапе backfill).
        const folder = f.folderId ? folderById.get(f.folderId) : undefined;
        const folderProjectId = folder
          ? resolveProjectIdForFolder(folder.id, folderById)
          : undefined;
        matchScope = tagMatch || folderProjectId === activeScope.projectId;
      } else if (activeScope.kind === "folder") {
        const folderMatch =
          !!activeScope.allowedFolderIds &&
          !!f.folderId &&
          activeScope.allowedFolderIds.has(f.folderId);
        const tags = new Set((f.tags ?? []).map((t) => t.name.toLowerCase()));
        const projectMatch =
          !!activeScope.projectId && tags.has(`project:${activeScope.projectId}`);
        matchScope = folderMatch || projectMatch;
      }
      // ── kind / source / поиск ───────────────────────────────
      const kind = resolveFileKind(f);
      const folder = f.folderId ? folderById.get(f.folderId) : undefined;
      const source = resolveFileSource(f, folder);
      const matchKind = fileKindFilter === "all" || fileKindFilter === kind;
      const matchSource = sourceFilter === "all" || sourceFilter === source;
      const matchQuery =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.originalName.toLowerCase().includes(q) ||
        f.uploaderId.toLowerCase().includes(q);
      return matchScope && matchKind && matchSource && matchQuery;
    });

    // ── Сортировка ────────────────────────────────────────────
    // Стабильная сортировка по выбранному полю + направлению.
    // Для `modified` берём `updatedAt`, фоллбэчим на `createdAt`,
    // чтобы свежезагруженные файлы (у которых нет updatedAt) шли
    // не в конец списка. Имя автора резолвим inline через
    // `authorById`, чтобы не тащить нестабильную замыкание-функцию
    // в массив зависимостей useMemo.
    const dirMul = sortDir === "asc" ? 1 : -1;
    const labelOf = (uid: string): string =>
      authorById[uid] ?? uid.slice(0, 8);
    const sorted = [...matched].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name) * dirMul;
        case "size":
          return (a.sizeBytes - b.sizeBytes) * dirMul;
        case "author":
          return labelOf(a.uploaderId).localeCompare(labelOf(b.uploaderId)) * dirMul;
        case "modified":
        default: {
          const aT = (a.updatedAt ?? a.createdAt ?? "");
          const bT = (b.updatedAt ?? b.createdAt ?? "");
          return aT.localeCompare(bT) * dirMul;
        }
      }
    });
    return sorted;
  }, [
    files,
    activeScope,
    query,
    fileKindFilter,
    sourceFilter,
    sortBy,
    sortDir,
    folderById,
    authorById,
  ]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeFolderRecord = activeFolder === "all" ? undefined : folders.find((f) => f.id === activeFolder);
  const activeFolderName =
    activeFolder === "all"
      ? doc.allFiles
      : (activeFolderRecord?.projectId ? allProjects.find((p) => p.id === activeFolderRecord.projectId)?.name : undefined) ??
        activeFolderRecord?.name ??
        activeFolder;

  const fileKindOptions: Array<{ value: FileKindFilter; label: string }> = [
    { value: "all", label: doc.typeAll },
    { value: "image", label: doc.typeImages },
    { value: "video", label: doc.typeVideos },
    { value: "document", label: doc.typeDocs },
    { value: "spreadsheet", label: doc.typeSheets },
    { value: "archive", label: doc.typeArchives },
    { value: "other", label: doc.typeOther },
  ];

  const sourceOptions: Array<{ value: FileSourceFilter; label: string }> = [
    { value: "all", label: doc.sourceAll },
    { value: "project", label: doc.sourceProject },
    { value: "chat", label: doc.sourceChat },
    { value: "task", label: doc.sourceTask },
    { value: "comment", label: doc.sourceComment },
    { value: "storage", label: doc.sourceStorage },
    { value: "shared", label: doc.sourceShared },
    { value: "private", label: doc.sourcePrivate },
    { value: "locked", label: doc.sourceLocked },
  ];

  const sortOptions: Array<{ value: SortBy; label: string }> = [
    { value: "modified", label: doc.sortByModified },
    { value: "name", label: doc.sortByName },
    { value: "size", label: doc.sortBySize },
    { value: "author", label: doc.sortByAuthor },
  ];

  /**
   * Сводный список активных фильтров для отрисовки чипов в тулбаре.
   * Учитываем `sourceFilter`, `fileKindFilter` и activeFolder (если
   * это проект или папка, а не "all"). Каждый чип знает, как себя
   * сбросить — это нужно для одиночного «×» на чипе.
   */
  const activeFilterChips: Array<{
    key: string;
    kindLabel: string;
    label: string;
    onClear: () => void;
  }> = [];
  if (sourceFilter !== "all") {
    const opt = sourceOptions.find((o) => o.value === sourceFilter);
    if (opt) {
      activeFilterChips.push({
        key: "source",
        kindLabel: doc.activeFilterSource,
        label: opt.label,
        onClear: () => setSourceFilter("all"),
      });
    }
  }
  if (fileKindFilter !== "all") {
    const opt = fileKindOptions.find((o) => o.value === fileKindFilter);
    if (opt) {
      activeFilterChips.push({
        key: "kind",
        kindLabel: doc.activeFilterKind,
        label: opt.label,
        onClear: () => setFileKindFilter("all"),
      });
    }
  }
  if (activeFolder !== "all") {
    let chipLabel = activeFolderName;
    let chipKind = doc.activeFilterFolder;
    if (activeFolder.startsWith("proj:")) {
      const projectId = activeFolder.slice(5);
      const proj = allProjects.find((p) => p.id === projectId);
      chipLabel = proj?.name ?? projectId;
      chipKind = doc.activeFilterProject;
    } else if (activeFolderRecord?.projectId) {
      chipKind = doc.activeFilterProject;
    }
    activeFilterChips.push({
      key: "folder",
      kindLabel: chipKind,
      label: chipLabel,
      onClear: () => setActiveFolder("all"),
    });
  }

  /** Сбрасывает все фильтры одним кликом (но не сортировку и не view). */
  const clearAllFilters = useCallback(() => {
    setActiveFolder("all");
    setFileKindFilter("all");
    setSourceFilter("all");
    setQuery("");
  }, []);

  /** Локализованное имя для `FileKind`, используется в колонке Type. */
  const kindLabel: Record<Exclude<FileKindFilter, "all">, string> = {
    image: doc.kindImage,
    video: doc.kindVideo,
    document: doc.kindDocument,
    spreadsheet: doc.kindSpreadsheet,
    archive: doc.kindArchive,
    other: doc.kindOther,
  };

  /** Загрузка одного или нескольких файлов из <input type="file"> в активную папку. */
  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || !activeWorkspaceId) return;
    setUploading(true);
    try {
      const folderId = activeFolder !== "all" ? activeFolder : undefined;
      for (const f of Array.from(fileList)) {
        try {
          await api.uploadFile(activeWorkspaceId, f, { folderId });
        } catch {
          // ошибка одного файла не должна остановить остальные
        }
      }
      setRefreshKey((k) => k + 1);
    } finally {
      setUploading(false);
    }
  };

  /** Открыть модалку создания папки (prompt→Dialog рефактор). */
  const openCreateFolder = () => {
    setCreateFolderName("");
    setCreateFolderOpen(true);
  };

  /** Подтверждение создания папки из модалки. */
  const confirmCreateFolder = async () => {
    if (!activeWorkspaceId) return;
    const name = createFolderName.trim();
    if (!name) return;
    try {
      await api.createFolder({
        workspaceId: activeWorkspaceId,
        name,
        parentFolderId: activeFolder !== "all" ? activeFolder : undefined,
      });
      setRefreshKey((k) => k + 1);
      setCreateFolderOpen(false);
      setCreateFolderName("");
    } catch {
      // ignore — TODO: показать toast
    }
  };

  /**
   * Реально скачать файл (а не открыть preview в новой вкладке).
   *
   * Раньше делали `window.open(presignedUrl)` — но для PDF/изображений
   * браузер просто открывает их inline, а не сохраняет. Решение: fetch'им
   * blob с presigned URL и создаём blob:URL, по которому кликаем invisible
   * `<a download="...">`. Браузер видит атрибут download и СОХРАНЯЕТ файл.
   *
   * Альтернатива (force `Content-Disposition: attachment` на бэке) требует
   * правки presigned URL generation — это сложнее и блокирует preview.
   */
  const handleDownload = async (fileId: string, fileName?: string) => {
    try {
      const dl = await api.getFileDownloadUrl(fileId);
      if (!dl.url) return;
      const res = await fetch(dl.url, { credentials: "omit" });
      if (!res.ok) return;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      // Если имя не передали — извлечём из исходного имени файла в списке.
      const fallbackName = files.find((f) => f.id === fileId)?.originalName
        || files.find((f) => f.id === fileId)?.name
        || `file-${fileId}`;
      a.download = fileName || fallbackName;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Освобождаем blob:URL через секунду — этого достаточно, чтобы
      // браузер успел его потребить.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      // ignore — TODO: показать toast
    }
  };

  const handleDownloadSelected = async () => {
    // Последовательно с задержкой 200ms между файлами: иначе браузеры
    // (особенно Firefox/Safari) глотают второй и последующие download-клики,
    // считая их «несвязанными с user gesture».
    for (const id of selected) {
      await handleDownload(id);
      await new Promise((r) => setTimeout(r, 200));
    }
  };

  /* ── Context menu / Rename / Delete ─────────────────────────── */

  /**
   * Открыть контекстное меню в координатах правого клика.
   * Координаты ограничиваем шириной viewport, чтобы меню не уезжало
   * за пределы экрана на правом/нижнем краю.
   */
  const openContextMenu = (
    e: React.MouseEvent,
    kind: "file" | "folder",
    id: string,
    name: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, kind, id, name });
  };

  const openRenameDialog = (kind: "file" | "folder", id: string, name: string) => {
    setRenameTarget({ kind, id, name });
    setRenameName(name);
    setContextMenu(null);
  };

  const confirmRename = async () => {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name || name === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    try {
      if (renameTarget.kind === "file") {
        await api.renameFile(renameTarget.id, name);
      } else {
        await api.renameFolder(renameTarget.id, name);
      }
      setRefreshKey((k) => k + 1);
      setRenameTarget(null);
    } catch {
      // ignore — TODO: показать toast
    }
  };

  const openDeleteDialog = (kind: "file" | "folder", id: string, name: string) => {
    setDeleteTarget({ kind, id, name });
    setContextMenu(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deletingInFlight) return;
    setDeletingInFlight(true);
    try {
      if (deleteTarget.kind === "file") {
        await api.deleteFile(deleteTarget.id);
      } else {
        // Если удаляем активно-выбранную папку — переключаемся на "all",
        // иначе в правом списке останется битый scope, который никогда
        // не разрезолвится в folderById.
        if (activeFolder === deleteTarget.id) setActiveFolder("all");
        await api.deleteFolder(deleteTarget.id);
      }
      setRefreshKey((k) => k + 1);
      setDeleteTarget(null);
    } catch {
      // ignore — TODO: показать toast
    } finally {
      setDeletingInFlight(false);
    }
  };

  /**
   * Закрываем контекстное меню на Esc/scroll/resize. Click-outside
   * обрабатывается прозрачным overlay'ем в самом portal'е.
   */
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  /* ── Storage usage ──────────────────────────────────────────── */

  /**
   * Реальное использование хранилища считаем как сумму `sizeBytes`
   * всех файлов workspace, которые мы уже загрузили в `files`.
   * Квоту берём как 10 GB по умолчанию (TODO: вытянуть из workspace
   * settings, как только бэкенд будет это отдавать).
   */
  const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
  const totalSizeBytes = useMemo(
    () => files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0),
    [files],
  );
  const usagePct = Math.min(100, (totalSizeBytes / STORAGE_QUOTA_BYTES) * 100);

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col gap-0 py-6">
      {/* Top toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-tight">{doc.title}</h1>
          <Text color="muted" className="m-0 mt-1 text-sm">{doc.subtitle}</Text>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleUploadFiles(e.target.files);
              if (e.target) e.target.value = "";
            }}
          />
          <Button size="sm" variant="secondary" onPress={openCreateFolder} isDisabled={!activeWorkspaceId}>
            <Folder02Icon size={14} />{doc.newFolder}
          </Button>
          <Button
            size="sm"
            onPress={() => fileInputRef.current?.click()}
            isDisabled={!activeWorkspaceId || uploading}
          >
            <Add01Icon size={14} />{doc.upload}
          </Button>
        </div>
      </div>

      {/* Manager shell */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]">
        {/* Sidebar: All files, источники, проекты, обычные папки. */}
        <aside className="hidden w-[220px] shrink-0 border-r border-[var(--border)]/60 lg:flex flex-col">
          <div className="px-3 py-3 border-b border-[var(--border)]/60">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-muted/70">{doc.folders}</p>
          </div>
          <ScrollArea className="flex-1 px-2 py-2">
            {/* All files shortcut. Сбрасываем sourceFilter, чтобы фильтр
              * «Чат / Задача / …» не перебивал намерение «показать всё». */}
            <button
              type="button"
              onClick={() => {
                setActiveFolder("all");
                setSourceFilter("all");
                setFileKindFilter("all");
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors ${
                activeFolder === "all" && sourceFilter === "all" && fileKindFilter === "all"
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-muted hover:bg-[var(--surface-secondary)] hover:text-foreground"
              }`}
            >
              <GridViewIcon size={14} strokeWidth={1.8} className="shrink-0 text-blue-500" />
              <span>{doc.allFiles}</span>
            </button>

            {/* ── Проекты ───────────────────────────────────────
              * Список всех проектов workspace. Если у проекта есть
              * PROJECT-folder, кликом активируем его (можно раскрыть
              * подпапки); иначе используем виртуальный proj:<id>,
              * который фильтрует по тегу `project:<id>` на файлах.
              *
              * Цвет проекта (`project.color`) применяется к иконке и
              * активной подсветке — так визуально совпадает с табами
              * проектов в шапке (см. `app-shell.tsx`). */}
            <div className="mt-3 mb-1 px-2">
              <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-muted/60">
                {doc.sectionProjects}
              </p>
            </div>
            {allProjects.length === 0 && (
              <p className="m-0 px-2 py-1 text-[12px] text-muted/60">
                {doc.noProjects}
              </p>
            )}
            {allProjects.map((proj) => {
              const projectFolder = projectFolderByProjectId.get(proj.id);
              if (projectFolder) {
                const node = buildFolderTree([projectFolder, ...folders.filter((f) => f.id !== projectFolder.id)], allProjects)
                  .find((n) => n.id === projectFolder.id);
                if (node) {
                  return (
                    <FolderTreeItem
                      key={proj.id}
                      node={node}
                      active={activeFolder}
                      isProjectNode
                      projectColor={proj.color}
                      onSelect={setActiveFolder}
                      onContextMenu={(e, id, name) => openContextMenu(e, "folder", id, name)}
                    />
                  );
                }
              }
              const virtualId = `proj:${proj.id}`;
              const isActive = activeFolder === virtualId;
              const color = proj.color;
              const activeStyle: React.CSSProperties | undefined =
                isActive && color
                  ? { backgroundColor: hexToRgba(color, 0.14), color }
                  : undefined;
              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => setActiveFolder(virtualId)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors ${
                    isActive
                      ? color
                        ? "font-medium"
                        : "bg-accent/10 text-accent font-medium"
                      : "text-muted hover:bg-[var(--surface-secondary)] hover:text-foreground"
                  }`}
                  style={activeStyle}
                >
                  <Folder02Icon
                    size={14}
                    strokeWidth={1.8}
                    className={`shrink-0 ${color ? "" : "text-blue-500"}`}
                    style={color ? { color } : undefined}
                  />
                  <span className="truncate">{proj.name}</span>
                </button>
              );
            })}

            {/* ── Обычные папки (не привязанные к проектам) ───── */}
            <div className="mt-3 mb-1 px-2">
              <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-muted/60">
                {doc.sectionFolders}
              </p>
            </div>
            {nonProjectRoots.length === 0 && (
              <p className="m-0 px-2 py-1 text-[12px] text-muted/60">
                {doc.noFoldersHint}
              </p>
            )}
            {nonProjectRoots.map((node) => (
              <FolderTreeItem
                key={node.id}
                node={node}
                active={activeFolder}
                onSelect={setActiveFolder}
                onContextMenu={(e, id, name) => openContextMenu(e, "folder", id, name)}
              />
            ))}
          </ScrollArea>
          {/* Storage usage — реальный расчёт из суммы sizeBytes всех
              файлов workspace. Квота хардкожена (10 GB) — TODO: тянуть из
              настроек workspace как только бэкенд будет их отдавать. */}
          <div className="border-t border-[var(--border)]/60 px-3 py-3">
            <Text color="muted" className="m-0 text-[11px]">
              {doc.storageHint}: {formatSize(totalSizeBytes)} {doc.storageOf} {formatSize(STORAGE_QUOTA_BYTES)}
            </Text>
            <div className="mt-1.5 h-1 rounded-full bg-[var(--surface-secondary)] overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${usagePct.toFixed(2)}%` }}
              />
            </div>
            <Text color="muted" className="m-0 mt-1 text-[10px] opacity-70">
              {usagePct.toFixed(1)}% {doc.storageUsed}
            </Text>
          </div>
        </aside>

        {/* Main panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Panel toolbar */}
          <div className="flex items-center gap-2 border-b border-[var(--border)]/60 px-4 py-2.5">
            {/* Breadcrumb */}
            <div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
              <button
                type="button"
                onClick={() => setActiveFolder("all")}
                className="shrink-0 text-muted transition-colors hover:text-foreground"
              >
                {doc.files}
              </button>
              {activeFolder !== "all" && (
                <>
                  <ArrowRight01Icon size={12} strokeWidth={2} className="shrink-0 text-muted/50" />
                  <span className="truncate font-medium">{activeFolderName}</span>
                </>
              )}
            </div>

            {/* Search */}
            <div className="relative flex items-center">
              <Search01Icon size={14} strokeWidth={2} className="absolute left-2.5 text-muted/60 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={doc.searchPlaceholder}
                className="h-8 rounded-lg border border-[var(--border)] bg-transparent pl-8 pr-3 text-xs placeholder:text-muted/50 focus:border-accent/50 focus:outline-none transition-colors w-36 focus:w-52"
              />
            </div>

            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-[var(--border)]/60 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                  viewMode === "grid" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                <GridViewIcon size={13} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                  viewMode === "list" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                <Menu01Icon size={13} strokeWidth={1.8} />
              </button>
            </div>

            {selected.size > 0 && (
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0"
                onPress={() => void handleDownloadSelected()}
              >
                <FileDownloadIcon size={14} />
                {selected.size} {doc.selected}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)]/60 px-4 py-3">
            <FilterSelect
              label={doc.filterTypeLabel}
              value={fileKindFilter}
              options={fileKindOptions}
              onChange={(v) => setFileKindFilter(v as FileKindFilter)}
            />
            <FilterSelect
              label={doc.filterSourceLabel}
              value={sourceFilter}
              options={sourceOptions}
              onChange={(v) => setSourceFilter(v as FileSourceFilter)}
            />
            {/* Sort by + asc/desc toggle. Сортировка применяется к
              * `filteredFiles` после фильтрации; «Modified» по умолчанию
              * desc (свежие — сверху), что соответствует тому, как
              * обычно ищут «недавнее». */}
            <FilterSelect
              label={doc.sortLabel}
              value={sortBy}
              options={sortOptions}
              onChange={(v) => setSortBy(v as SortBy)}
            />
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              title={sortDir === "asc" ? doc.sortToggleDescTitle : doc.sortToggleAscTitle}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)]/60 text-muted transition-colors hover:bg-[var(--surface-secondary)] hover:text-foreground"
            >
              {sortDir === "asc" ? (
                <ArrowUp01Icon size={14} strokeWidth={2} />
              ) : (
                <ArrowDown01Icon size={14} strokeWidth={2} />
              )}
            </button>

            {/* Активные фильтры — компактные «удаляемые» чипы. */}
            {activeFilterChips.length > 0 && (
              <div className="flex items-center gap-1.5">
                {activeFilterChips.map((chip) => (
                  <Chip
                    key={chip.key}
                    size="sm"
                    color="accent"
                    variant="soft"
                    className="cursor-pointer"
                  >
                    <span className="mr-1 text-[10px] uppercase tracking-wide opacity-70">{chip.kindLabel}:</span>
                    <span>{chip.label}</span>
                    <button
                      type="button"
                      onClick={chip.onClear}
                      className="ml-1 flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-accent/20"
                      aria-label={doc.clearFilters}
                    >
                      <Cancel01Icon size={10} strokeWidth={2.4} />
                    </button>
                  </Chip>
                ))}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-[11px] font-medium text-muted underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  {doc.clearFilters}
                </button>
              </div>
            )}
          </div>

          {/* Files area */}
          <ScrollArea className="flex-1">
            {viewMode === "list" ? (
              <div>
                {/* Column headers */}
                <div className="grid grid-cols-[24px_1fr_90px_80px_90px_80px] gap-3 border-b border-[var(--border)]/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
                  <span />
                  <span>{doc.colName}</span>
                  <span className="hidden sm:block">{doc.colType}</span>
                  <span className="hidden sm:block">{doc.colAuthor}</span>
                  <span>{doc.colModified}</span>
                  <span className="hidden md:block">{doc.colSize}</span>
                </div>
                <div className="divide-y divide-[var(--border)]/30">
                  {filteredFiles.map((file) => {
                    const isSelected = selected.has(file.id);
                    const ext = fileExt(file.originalName || file.name);
                    const folder = file.folderId ? folderById.get(file.folderId) : undefined;
                    const kind = resolveFileKind(file);
                    const previewSrc = getFilePreviewSrc(file);
                    return (
                      <div
                        key={file.id}
                        onClick={() => toggleSelect(file.id)}
                        onDoubleClick={() => void handleDownload(file.id)}
                        onContextMenu={(e) => openContextMenu(e, "file", file.id, file.name)}
                        className={`group grid cursor-pointer grid-cols-[24px_1fr_90px_80px_90px_80px] items-center gap-3 px-4 py-3 transition-colors ${
                          isSelected
                            ? "bg-accent/5"
                            : "hover:bg-[var(--surface-secondary)]/40"
                        }`}
                      >
                        {/* Checkbox */}
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-accent bg-accent text-white"
                              : "border-[var(--border)] opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          {isSelected && (
                            <svg width="10" height="8" fill="none" stroke="currentColor" strokeWidth={2.5}>
                              <path d="M1 4l2.5 2.5L9 1" />
                            </svg>
                          )}
                        </span>
                        {/* Name */}
                        <div className="flex min-w-0 items-center gap-2.5">
                          {isPreviewable(file) ? (
                            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-[var(--border)]/50 bg-[var(--surface-secondary)]">
                              {kind === "image" ? (
                                <img src={previewSrc} alt={file.name} className="h-full w-full object-cover" loading="lazy" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900/10 to-slate-900/20 text-[10px] font-bold uppercase text-slate-600">
                                  {doc.videoPreview}
                                </div>
                              )}
                            </div>
                          ) : (
                            <FileTypeIcon ext={ext} className="h-8 w-8" iconSize={18} />
                          )}
                          <div className="min-w-0">
                            <p className="m-0 truncate text-sm font-medium">{file.name}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-muted">
                              {file.isShared ? <span className="text-accent">{doc.shared}</span> : null}
                              {file.isLocked ? <span className="text-amber-600">{doc.locked}</span> : null}
                              {folder?.projectId ? <span className="text-blue-600">{allProjects.find((p) => p.id === folder.projectId)?.name ?? folder.name}</span> : null}
                            </div>
                          </div>
                        </div>
                        <Text className="m-0 hidden text-muted text-xs sm:block">{kindLabel[kind]}</Text>
                        <Text className="m-0 hidden truncate text-muted text-xs sm:block" title={authorLabel(file.uploaderId)}>
                          {authorLabel(file.uploaderId)}
                        </Text>
                        <Text className="m-0 text-muted text-xs">{formatRelative(file.updatedAt ?? file.createdAt, locale)}</Text>
                        <Text className="m-0 hidden text-muted text-xs md:block">{formatSize(file.sizeBytes)}</Text>
                      </div>
                    );
                  })}
                  {filteredFiles.length === 0 && (
                    <div className="py-16 text-center">
                      <File02Icon size={32} strokeWidth={1.4} className="mx-auto mb-3 text-muted/30" />
                      <Text className="m-0 text-muted text-sm">{doc.noFiles}</Text>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
                {filteredFiles.map((file) => {
                  const isSelected = selected.has(file.id);
                  const ext = fileExt(file.originalName || file.name);
                  const folder = file.folderId ? folderById.get(file.folderId) : undefined;
                  const kind = resolveFileKind(file);
                  const previewSrc = getFilePreviewSrc(file);
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => toggleSelect(file.id)}
                      onDoubleClick={() => void handleDownload(file.id)}
                      onContextMenu={(e) => openContextMenu(e, "file", file.id, file.name)}
                      className={`group flex flex-col items-start rounded-xl border p-3 text-left transition-all duration-200 ${
                        isSelected
                          ? "border-accent/40 bg-accent/5"
                          : "border-[var(--border)]/60 hover:border-[var(--border)] hover:bg-[var(--surface-secondary)]/40"
                      }`}
                    >
                      {isPreviewable(file) ? (
                        <div className="mb-3 h-20 w-full overflow-hidden rounded-xl border border-[var(--border)]/50 bg-[var(--surface-secondary)]">
                          {kind === "image" ? (
                            <img src={previewSrc} alt={file.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900/10 to-slate-900/20 text-sm font-semibold text-slate-600">
                              {doc.videoPreview}
                            </div>
                          )}
                        </div>
                      ) : (
                        <FileTypeIcon ext={ext} className="mb-3 h-10 w-10 rounded-xl" iconSize={22} />
                      )}
                      <p className="m-0 w-full truncate text-sm font-medium">{file.name}</p>
                      <Text className="m-0 mt-1 text-muted text-[11px]">
                        {formatSize(file.sizeBytes)} · {formatRelative(file.updatedAt ?? file.createdAt, locale)}
                      </Text>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {file.isShared ? <Chip size="sm" color="warning" variant="soft">{doc.shared}</Chip> : null}
                        {file.isLocked ? <Chip size="sm" color="default" variant="soft">{doc.locked}</Chip> : null}
                        {folder?.projectId ? (
                          <Chip size="sm" color="accent" variant="soft">{allProjects.find((p) => p.id === folder.projectId)?.name ?? folder.name}</Chip>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
                {filteredFiles.length === 0 && (
                  <div className="col-span-full py-16 text-center">
                    <File02Icon size={32} strokeWidth={1.4} className="mx-auto mb-3 text-muted/30" />
                    <Text className="m-0 text-muted text-sm">{doc.noFiles}</Text>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Status bar */}
          <div className="flex items-center justify-between border-t border-[var(--border)]/60 px-4 py-2">
            <Text color="muted" className="m-0 text-[11px]">
              {filteredFiles.length} {filteredFiles.length !== 1 ? doc.colName.toLowerCase() + "s" : doc.colName.toLowerCase()}
              {selected.size > 0 && ` · ${selected.size} ${doc.selected}`}
            </Text>
            <Text color="muted" className="m-0 text-[11px]">{formatSize(totalSizeBytes)} {doc.storageUsed}</Text>
          </div>
        </div>
      </div>

      {/* ── Create folder dialog ────────────────────────────── */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{doc.createFolderTitle}</DialogTitle>
            <DialogDescription>{doc.createFolderDesc}</DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            type="text"
            value={createFolderName}
            onChange={(e) => setCreateFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void confirmCreateFolder();
              }
            }}
            placeholder={doc.folderNamePlaceholder}
            className="w-full rounded-xl border border-[var(--border)]/60 bg-transparent px-3 py-2 text-sm placeholder:text-muted/50 focus:border-accent/50 focus:outline-none"
          />
          <DialogFooter>
            <Button size="sm" variant="secondary" onPress={() => setCreateFolderOpen(false)}>
              {doc.cancel}
            </Button>
            <Button size="sm" onPress={() => void confirmCreateFolder()} isDisabled={!createFolderName.trim()}>
              {doc.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rename dialog (file or folder) ─────────────────── */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => { if (!o) setRenameTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {renameTarget?.kind === "folder" ? doc.renameFolderTitle : doc.renameFileTitle}
            </DialogTitle>
            <DialogDescription>{doc.renameDesc}</DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            type="text"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void confirmRename();
              }
            }}
            placeholder={doc.newNamePlaceholder}
            className="w-full rounded-xl border border-[var(--border)]/60 bg-transparent px-3 py-2 text-sm placeholder:text-muted/50 focus:border-accent/50 focus:outline-none"
          />
          <DialogFooter>
            <Button size="sm" variant="secondary" onPress={() => setRenameTarget(null)}>
              {doc.cancel}
            </Button>
            <Button
              size="sm"
              onPress={() => void confirmRename()}
              isDisabled={!renameName.trim() || renameName.trim() === renameTarget?.name}
            >
              {doc.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ─────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deletingInFlight) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.kind === "folder" ? doc.deleteFolderTitle : doc.deleteFileTitle}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.kind === "folder" ? doc.deleteFolderConfirm : doc.deleteFileConfirm}
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--surface-secondary)]/40 px-3 py-2 text-sm">
              <span className="font-medium truncate inline-block max-w-full">{deleteTarget.name}</span>
            </div>
          )}
          <DialogFooter>
            <Button size="sm" variant="secondary" onPress={() => setDeleteTarget(null)} isDisabled={deletingInFlight}>
              {doc.cancel}
            </Button>
            <Button
              size="sm"
              className="bg-red-500 hover:bg-red-600 text-white"
              onPress={() => void confirmDelete()}
              isDisabled={deletingInFlight}
            >
              {doc.deleteConfirmCTA}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Context menu (right-click) ──────────────────────── */}
      {contextMenu && typeof document !== "undefined" && createPortal(
        <>
          {/* Прозрачный overlay — click outside / right-click outside закрывают меню. */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            className="fixed z-[9999] min-w-[180px] rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] py-1 shadow-2xl backdrop-blur-xl"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 200),
              top: Math.min(contextMenu.y, window.innerHeight - 160),
            }}
          >
            {contextMenu.kind === "file" && (
              <button
                type="button"
                onClick={() => {
                  void handleDownload(contextMenu.id);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-[var(--surface-secondary)]"
              >
                <FileDownloadIcon size={14} strokeWidth={1.8} className="shrink-0 text-muted" />
                <span>{doc.ctxDownload}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openRenameDialog(contextMenu.kind, contextMenu.id, contextMenu.name)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-[var(--surface-secondary)]"
            >
              <Edit02Icon size={14} strokeWidth={1.8} className="shrink-0 text-muted" />
              <span>{doc.ctxRename}</span>
            </button>
            <div className="my-1 h-px bg-[var(--border)]/40" />
            <button
              type="button"
              onClick={() => openDeleteDialog(contextMenu.kind, contextMenu.id, contextMenu.name)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-500/10"
            >
              <Delete02Icon size={14} strokeWidth={1.8} className="shrink-0" />
              <span>{doc.ctxDelete}</span>
            </button>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
