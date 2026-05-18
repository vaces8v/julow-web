"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ProjectPayload, WorkspacePayload } from "@/lib/api";

type CreateProjectInput = {
  name: string;
  description?: string;
};

type WorkspaceShellContextValue = {
  /**
   * `true` до завершения первого `loadEverything()`. UI использует это
   * для показа skeleton-заглушек (например, в header'е с табами),
   * пока не известны workspaces и allProjects.
   *
   * Сбрасывается в false в finally-блоке первой загрузки — даже если
   * апи вернул ошибку (401 / network), иначе spinner остался бы
   * висеть навечно.
   */
  isInitialLoading: boolean;
  workspaces: WorkspacePayload[];
  /**
   * Проекты ТЕКУЩЕГО активного workspace'а (filtered view). Применяется
   * сайдбаром и страницами проектов.
   */
  projects: ProjectPayload[];
  /**
   * Все проекты пользователя через все workspaces (cross-workspace).
   * Нужно для случаев, когда пользователь зашёл по URL в проект, чей
   * workspace ещё не активирован (например, после принятия приглашения).
   */
  allProjects: ProjectPayload[];
  activeWorkspaceId: string;
  activeProjectId: string;
  setActiveWorkspaceId: (workspaceId: string) => void;
  setActiveProjectId: (projectId: string) => void;
  refreshProjects: () => Promise<void>;
  /**
   * Полная перезагрузка контекста: workspaces + все мои проекты. Использовать
   * после действий, которые могут изменить состав workspace'ов/проектов
   * пользователя (например, принятие приглашения в чужой workspace).
   */
  refreshAll: () => Promise<void>;
  /**
   * Создать проект на бэкенде и оптимистично добавить в локальный список.
   * При ошибке — реверт + пробрасывает исключение, чтобы вызвавший показал ошибку.
   */
  createProject: (input: CreateProjectInput) => Promise<ProjectPayload>;
  /**
   * Переименовать проект. Оптимистичное обновление + PATCH; при ошибке — откат.
   * Игнорирует пустые/идентичные значения.
   */
  renameProject: (projectId: string, name: string) => Promise<void>;
  /**
   * Поменять цвет проекта (HEX, например `#3b82f6`).
   * Оптимистичное обновление + PATCH; при ошибке — откат.
   */
  setProjectColor: (projectId: string, color: string) => Promise<void>;
  /**
   * Архивировать проект. Оптимистично убирает из списка; при ошибке — откат.
   */
  archiveProject: (projectId: string) => Promise<void>;
  /**
   * Запросить удаление проекта (soft-delete: статус PENDING_DELETION на
   * бэкенде). Оптимистично убирает из списка; при ошибке — откат.
   */
  deleteProject: (projectId: string) => Promise<void>;
};

const WorkspaceShellContext = createContext<WorkspaceShellContextValue | null>(null);

/**
 * localStorage-ключ для хранения «последнего активного проекта» в рамках
 * конкретного workspace. Scope'ится по `wsId`, чтобы при переключении
 * между workspace'ами восстанавливался правильный проект.
 */
function activeProjectStorageKey(workspaceId: string): string {
  return `julow:active_project:${workspaceId}`;
}

/**
 * localStorage-ключ для активного workspace. Без этой persistence после
 * reload пользователь возвращается на первый workspace, и закреплённые
 * табы из чужого workspace пропадают из панели.
 */
const ACTIVE_WORKSPACE_STORAGE_KEY = "julow:active_workspace";

function readPersistedActiveWorkspace(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * SSR-safe чтение `activeProjectId` из localStorage. На сервере (где нет
 * `window`) и в приватном режиме браузера возвращает пустую строку, чтобы
 * провайдер фоллбэкнулся на первый проект из списка.
 */
function readPersistedActiveProject(workspaceId: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(activeProjectStorageKey(workspaceId)) ?? "";
  } catch {
    return "";
  }
}

type WorkspaceShellProviderProps = {
  children: React.ReactNode;
};

export function WorkspaceShellProvider({ children }: WorkspaceShellProviderProps) {
  const [workspaces, setWorkspaces] = useState<WorkspacePayload[]>([]);
  /**
   * Все проекты пользователя через все workspaces (источник истины).
   * `projects` ниже — это просто отфильтрованный вид по `activeWorkspaceId`.
   * Так UI остаётся консистентным, и страница доски может найти проект из
   * чужого workspace'а (например, после принятия приглашения как GUEST).
   */
  const [allProjects, setAllProjects] = useState<ProjectPayload[]>([]);
  // Читаем сохранённый workspace из localStorage ленивым инициализатором.
  // Валидация (что workspace всё ещё существует) будет в loadEverything после
  // фетча. Если stored ID валиден — оставляем его; иначе сбрасываем на
  // первый из списка.
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => readPersistedActiveWorkspace());
  const [activeProjectId, setActiveProjectId] = useState("");
  /**
   * Флаг инициальной загрузки. Старт = true; сбрасывается после первого
   * завершённого `loadEverything()` (включая случаи ошибок). Нужен для
   * показа skeleton-табов в верхнем баре во время cold start.
   */
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  /**
   * Защита от устаревших ответов: если за время выполнения запроса пользователь
   * переключил workspace, мы должны отбросить пришедший позже список проектов
   * предыдущего workspace, чтобы не "мигать" чужими данными.
   */
  const projectsRequestSeqRef = useRef(0);

  /**
   * Промис первоначальной загрузки workspace'ов. Мутации (createProject и т.п.)
   * дожидаются его перед чтением `activeWorkspaceId`, иначе на «холодный» клик
   * по + (когда workspaces ещё грузятся или у нового пользователя их нет)
   * мы бы падали с ошибкой. Ref, а не state, чтобы не ре-рендерить на каждое
   * изменение и не создавать гонок.
   */
  const initPromiseRef = useRef<Promise<void> | null>(null);

  /**
   * Зеркало `activeWorkspaceId` в ref: мутации внутри `useCallback` читают
   * его после `await`, когда замыкание уже содержит устаревшее значение из
   * момента создания колбэка.
   */
  const activeWorkspaceIdRef = useRef("");
  useEffect(() => {
    activeWorkspaceIdRef.current = activeWorkspaceId;
  }, [activeWorkspaceId]);

  /**
   * Полная загрузка: workspaces + все мои проекты cross-workspace. Используется
   * на mount и через `refreshAll()` после действий, которые могут изменить
   * состав workspace'ов/проектов (например, приёма приглашения).
   */
  const loadEverything = useCallback(async (): Promise<void> => {
    const seq = ++projectsRequestSeqRef.current;
    let workspaceList: WorkspacePayload[] = [];
    let allProjectList: ProjectPayload[] = [];
    try {
      [workspaceList, allProjectList] = await Promise.all([
        api.getWorkspaces(),
        api.getMyProjects().catch(() => [] as ProjectPayload[]),
      ]);
    } finally {
      // Сбрасываем флаг в finally — даже если api.getWorkspaces() упал
      // (401 / network), спиннер не должен висеть вечно. Реальный
      // refresh пользователь сможет сделать через refreshAll().
      setIsInitialLoading(false);
    }
    if (seq !== projectsRequestSeqRef.current) return;

    // Скрываем soft-deleted проекты на фронте: бэкенд продолжает их отдавать,
    // но для пользователя они «удалены».
    const visibleAll = allProjectList.filter(
      (p) => p.status?.toLowerCase() !== "pending_deletion",
    );
    setAllProjects(visibleAll);

    if (workspaceList.length === 0) {
      // Новый аккаунт: у пользователя ещё нет ни одного workspace. Бэкенд
      // требует `ws_id` для всех сущностей (projects, tasks, documents…),
      // поэтому поднимаем личный workspace типа PERSONAL автоматически,
      // чтобы UI был сразу рабочим.
      try {
        const created = await api.createWorkspace("Personal", "PERSONAL");
        setWorkspaces([created]);
        setActiveWorkspaceId((cur) => cur || created.id);
      } catch (err) {
        console.error("Failed to bootstrap personal workspace:", err);
        setWorkspaces([]);
      }
      return;
    }
    setWorkspaces(workspaceList);
    // Если активный workspace ещё не выбран (или сохранённый больше
    // не существует) — выбираем первый из списка. Иначе оставляем как
    // есть, чтобы не дёргать пользователя.
    setActiveWorkspaceId((cur) =>
      cur && workspaceList.some((w) => w.id === cur) ? cur : workspaceList[0].id,
    );
  }, []);

  useEffect(() => {
    initPromiseRef.current = loadEverything();
    void initPromiseRef.current;
  }, [loadEverything]);

  /**
   * Перечитывает только проекты (cross-workspace). Используется после
   * мутаций, которые не меняют список workspace'ов (CRUD внутри текущего).
   */
  const refreshProjects = useCallback(async (): Promise<void> => {
    const seq = ++projectsRequestSeqRef.current;
    const list = await api.getMyProjects();
    if (seq !== projectsRequestSeqRef.current) return;
    const visible = list.filter((p) => p.status?.toLowerCase() !== "pending_deletion");
    setAllProjects(visible);
  }, []);

  /**
   * Производный список проектов активного workspace'а (то, что видит сайдбар).
   */
  const projects = useMemo<ProjectPayload[]>(
    () =>
      activeWorkspaceId
        ? allProjects.filter((p) => p.workspaceId === activeWorkspaceId)
        : [],
    [allProjects, activeWorkspaceId],
  );

  /**
   * При смене активного workspace выбираем активный проект внутри него:
   * либо сохранённый в localStorage, либо первый из списка.
   */
  useEffect(() => {
    if (!activeWorkspaceId) return;
    setActiveProjectId((current) => {
      if (current && projects.some((p) => p.id === current)) return current;
      const persisted = readPersistedActiveProject(activeWorkspaceId);
      if (persisted && projects.some((p) => p.id === persisted)) return persisted;
      return projects[0]?.id ?? "";
    });
  }, [activeWorkspaceId, projects]);

  /**
   * Сохраняем `activeProjectId` в localStorage при каждом изменении.
   * Ключ scope'ится по workspace, чтобы переключение между workspace'ами
   * корректно восстанавливало последний открытый проект *этого* workspace.
   *
   * Сохраняем только настоящие проектные id (UUID из бэкенда), а локальные
   * `custom-`/`dup-` табы пропускаем — после reload их всё равно нет.
   */
  useEffect(() => {
    if (!activeWorkspaceId) return;
    if (!activeProjectId) return;
    if (activeProjectId.startsWith("custom-") || activeProjectId.startsWith("dup-")) return;
    try {
      localStorage.setItem(activeProjectStorageKey(activeWorkspaceId), activeProjectId);
    } catch {
      /* приватный режим / quota — ignore */
    }
  }, [activeWorkspaceId, activeProjectId]);

  /**
   * Persist `activeWorkspaceId` в localStorage. Нужно, чтобы после reload
   * пользователь вернулся в тот же workspace — иначе закреплённые
   * cross-workspace табы выглядят как «исчезли».
   */
  useEffect(() => {
    if (!activeWorkspaceId) return;
    try {
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, activeWorkspaceId);
    } catch {
      /* приватный режим / quota — ignore */
    }
  }, [activeWorkspaceId]);

  /* ── Mutations: optimistic + backend sync ──────────────────── */

  const createProject = useCallback(
    async ({ name, description }: CreateProjectInput): Promise<ProjectPayload> => {
      // 1) Дожидаемся первоначальной загрузки workspace'ов (на новых аккаунтах
      //    это также триггерит авто-создание personal workspace). Без этого
      //    «холодный» клик по + сразу после логина падал с "No active workspace".
      if (initPromiseRef.current) {
        try {
          await initPromiseRef.current;
        } catch {
          /* init handles its own errors; продолжаем и проверим ref ниже */
        }
      }
      // 2) Читаем актуальный ws_id из ref, потому что state-значение в замыкании
      //    было захвачено в момент создания колбэка и не обновилось после await.
      const wsId = activeWorkspaceIdRef.current;
      if (!wsId) {
        throw new Error("No active workspace");
      }
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("Project name is required");
      }
      const created = await api.createProject({
        workspaceId: wsId,
        name: trimmed,
        description: description?.trim() || undefined,
      });
      // Оптимистично добавляем в начало списка, чтобы пользователь сразу увидел
      // результат и не было "артефакта" с двойным фетчем после refresh.
      setAllProjects((prev) =>
        prev.some((p) => p.id === created.id) ? prev : [created, ...prev],
      );
      setActiveProjectId(created.id);
      return created;
    },
    [],
  );

  const renameProject = useCallback(
    async (projectId: string, name: string): Promise<void> => {
      if (!activeWorkspaceId) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const target = allProjects.find((p) => p.id === projectId);
      if (!target || target.name === trimmed) return;

      const previousName = target.name;
      // Optimistic
      setAllProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, name: trimmed } : p)),
      );
      try {
        await api.updateProjectInfo(activeWorkspaceId, projectId, { name: trimmed });
      } catch (err) {
        // Rollback
        setAllProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, name: previousName } : p)),
        );
        throw err;
      }
    },
    [activeWorkspaceId, allProjects],
  );

  const setProjectColor = useCallback(
    async (projectId: string, color: string): Promise<void> => {
      if (!activeWorkspaceId) return;
      const target = allProjects.find((p) => p.id === projectId);
      if (!target || target.color === color) return;

      const previousColor = target.color;
      setAllProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, color } : p)),
      );
      try {
        await api.updateProjectInfo(activeWorkspaceId, projectId, { color });
      } catch (err) {
        setAllProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, color: previousColor } : p)),
        );
        throw err;
      }
    },
    [activeWorkspaceId, allProjects],
  );

  const archiveProject = useCallback(
    async (projectId: string): Promise<void> => {
      if (!activeWorkspaceId) return;
      const snapshot = allProjects;
      // Optimistic remove from list
      setAllProjects((prev) => prev.filter((p) => p.id !== projectId));
      setActiveProjectId((current) => {
        if (current !== projectId) return current;
        const remaining = snapshot.filter(
          (p) => p.id !== projectId && p.workspaceId === activeWorkspaceId,
        );
        return remaining[0]?.id ?? "";
      });
      try {
        await api.archiveProject(activeWorkspaceId, projectId);
      } catch (err) {
        setAllProjects(snapshot);
        throw err;
      }
    },
    [activeWorkspaceId, allProjects],
  );

  /**
   * Request project deletion (soft-delete: PENDING_DELETION on backend).
   * Проект исчезает из списка сразу, чтобы UI не «отставал» от действия
   * пользователя. Даже если backend ещё хранит запись — для пользователя
   * её больше нет. При ошибке — восстанавливаем.
   */
  const deleteProject = useCallback(
    async (projectId: string): Promise<void> => {
      if (!activeWorkspaceId) return;
      const snapshot = allProjects;
      setAllProjects((prev) => prev.filter((p) => p.id !== projectId));
      setActiveProjectId((current) => {
        if (current !== projectId) return current;
        const remaining = snapshot.filter(
          (p) => p.id !== projectId && p.workspaceId === activeWorkspaceId,
        );
        return remaining[0]?.id ?? "";
      });
      try {
        await api.requestProjectDeletion(activeWorkspaceId, projectId);
      } catch (err) {
        setAllProjects(snapshot);
        throw err;
      }
    },
    [activeWorkspaceId, allProjects],
  );

  const value = useMemo(
    () => ({
      isInitialLoading,
      workspaces,
      projects,
      allProjects,
      activeWorkspaceId,
      activeProjectId,
      setActiveWorkspaceId,
      setActiveProjectId,
      refreshProjects,
      refreshAll: loadEverything,
      createProject,
      renameProject,
      setProjectColor,
      archiveProject,
      deleteProject,
    }),
    [
      isInitialLoading,
      workspaces,
      projects,
      allProjects,
      activeWorkspaceId,
      activeProjectId,
      refreshProjects,
      loadEverything,
      createProject,
      renameProject,
      setProjectColor,
      archiveProject,
      deleteProject,
    ],
  );

  return (
    <WorkspaceShellContext.Provider value={value}>
      {children}
    </WorkspaceShellContext.Provider>
  );
}

export function useWorkspaceShell() {
  const context = useContext(WorkspaceShellContext);
  if (!context) {
    throw new Error("useWorkspaceShell must be used within WorkspaceShellProvider");
  }
  return context;
}
