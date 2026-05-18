"use client";

/**
 * useLabelResolver — общий хук для дашбордов и редактора виджетов.
 *
 * Резолвит UUID'ы пользователей/проектов в человекочитаемые подписи
 * (email / название). Кеширует результаты per-workspace в module-level
 * `Map`, чтобы не дёргать API повторно при перемонтировании компонентов.
 *
 * Также возвращает массивы `userOptions` / `projectOptions` для
 * заполнения HeroUI Select при выборе значений в фильтрах.
 *
 * Спринты / эпики / статусы намеренно НЕ резолвятся здесь — для них
 * нужен projectId, а в контексте дашборда мы его не имеем. Они
 * остаются raw UUID до тех пор, пока пользователь не отфильтрует
 * виджет по проекту.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type AnalyticsResult,
  type ProjectPayload,
  type WorkspaceMemberPayload,
} from "@/lib/api";
import type { Locale } from "@/i18n/context";

type WorkspaceCache = {
  members: WorkspaceMemberPayload[];
  membersByUserId: Map<string, WorkspaceMemberPayload>;
  /** memberId → member (для случаев, когда id присоединён как membership id). */
  membersByMembershipId: Map<string, WorkspaceMemberPayload>;
  projects: ProjectPayload[];
  projectsById: Map<string, ProjectPayload>;
  /** email/displayName уже подгруженных пользователей через `getUserById`. */
  emails: Map<string, string>;
  loaded: boolean;
};

const _cache = new Map<string, WorkspaceCache>();
const _inflight = new Map<string, Promise<void>>();

function makeEmpty(): WorkspaceCache {
  return {
    members: [],
    membersByUserId: new Map(),
    membersByMembershipId: new Map(),
    projects: [],
    projectsById: new Map(),
    emails: new Map(),
    loaded: false,
  };
}

async function ensureLoaded(workspaceId: string): Promise<void> {
  const existing = _cache.get(workspaceId);
  if (existing?.loaded) return;
  const inflight = _inflight.get(workspaceId);
  if (inflight) return inflight;

  const promise = (async () => {
    const cache = existing ?? makeEmpty();
    _cache.set(workspaceId, cache);
    try {
      const [members, projects] = await Promise.all([
        api.getWorkspaceMembers(workspaceId).catch(() => [] as WorkspaceMemberPayload[]),
        api.getProjects(workspaceId).catch(() => [] as ProjectPayload[]),
      ]);
      cache.members = members;
      cache.projects = projects;
      cache.membersByUserId = new Map(members.map((m) => [m.userId, m]));
      cache.membersByMembershipId = new Map(members.map((m) => [m.id, m]));
      cache.projectsById = new Map(projects.map((p) => [p.id, p]));
      cache.loaded = true;
    } finally {
      _inflight.delete(workspaceId);
    }
  })();

  _inflight.set(workspaceId, promise);
  return promise;
}

export interface LabelResolver {
  /** Состояние первоначальной загрузки. После true — все мемберы/проекты в кеше. */
  ready: boolean;
  /** Получить подпись пользователя по его user_id. Возвращает email, displayName или короткий UUID. */
  resolveUser: (userId: string | null | undefined) => string;
  /** Подпись проекта по project_id. */
  resolveProject: (projectId: string | null | undefined) => string;
  /** Готовые опции для HeroUI Select при выборе пользователя. */
  userOptions: Array<{ value: string; label: string }>;
  /** Опции для Select при выборе проекта. */
  projectOptions: Array<{ value: string; label: string }>;
  /**
   * Подпись для любой колонки результата виджета: если колонка похожа
   * на user_id / assignee_id / reporter_id — резолвим в email,
   * если project_id — в название проекта. Иначе возвращает сырое
   * значение, преобразованное в строку.
   */
  resolveCell: (column: string, value: unknown) => string;
}

/**
 * Возвращает резолвер для конкретного воркспейса. Если `workspaceId`
 * не задан — резолвер всегда возвращает сырое значение.
 */
export function useLabelResolver(workspaceId: string | null | undefined): LabelResolver {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void ensureLoaded(workspaceId).then(() => {
      if (!cancelled) setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const cache = workspaceId ? _cache.get(workspaceId) ?? null : null;

  const shortId = useCallback((id: string) => id.slice(0, 6) + "…", []);

  const resolveUser = useCallback(
    (userId: string | null | undefined): string => {
      if (!userId) return "—";
      if (!cache) return shortId(userId);

      /**
       * Порядок резолва (от лучшего к худшему):
       *   1. displayName из workspace member;
       *   2. email, ранее закешированный через `getUserById`;
       *   3. шорт-UUID (последний фолбэк).
       *
       * Раньше шаг 1 досрочно отдавал shortId, если у мембера не было
       * displayName — поэтому в Team-табе появлялся «User 5d8e35» вместо
       * email'а. Теперь при отсутствии displayName мы продолжаем дальше
       * и подтягиваем email через `getUserById`.
       */
      const tryFetchEmail = (id: string) => {
        if (!cache.emails.has(id)) {
          cache.emails.set(id, ""); // placeholder, чтобы не запускать второй раз
          void api
            .getUserById(id)
            .then((u) => {
              cache.emails.set(id, u.email);
              setVersion((v) => v + 1);
            })
            .catch(() => {
              cache.emails.delete(id);
            });
        }
        return cache.emails.get(id) ?? "";
      };

      // membership.id чаще всего приходит из task.assignee_ids на бэке.
      const byMembership = cache.membersByMembershipId.get(userId);
      if (byMembership) {
        const real = cache.membersByUserId.get(byMembership.userId);
        const name = real?.displayName || byMembership.displayName;
        if (name) return name;
        const email = tryFetchEmail(byMembership.userId);
        return email || shortId(byMembership.userId);
      }

      const m = cache.membersByUserId.get(userId);
      if (m) {
        if (m.displayName) return m.displayName;
        // displayName отсутствует — резолвим email.
        const email = tryFetchEmail(userId);
        return email || shortId(userId);
      }

      // Не workspace-мембер вообще (другой воркспейс / удалён). Пробуем email.
      const email = tryFetchEmail(userId);
      return email || shortId(userId);
    },
    [cache, shortId],
  );

  const resolveProject = useCallback(
    (projectId: string | null | undefined): string => {
      if (!projectId) return "—";
      if (!cache) return shortId(projectId);
      const p = cache.projectsById.get(projectId);
      return p ? p.name : shortId(projectId);
    },
    [cache, shortId],
  );

  const userOptions = useMemo(() => {
    if (!cache) return [] as Array<{ value: string; label: string }>;
    return cache.members.map((m) => ({
      value: m.userId,
      label: m.displayName || shortId(m.userId),
    }));
  }, [cache, shortId]);

  const projectOptions = useMemo(() => {
    if (!cache) return [] as Array<{ value: string; label: string }>;
    return cache.projects.map((p) => ({ value: p.id, label: p.name }));
  }, [cache]);

  const resolveCell = useCallback(
    (column: string, value: unknown): string => {
      if (value == null) return "—";
      const str = typeof value === "string" ? value : String(value);
      const col = column.toLowerCase();
      if (
        col === "user_id" ||
        col === "assignee_id" ||
        col === "reporter_id" ||
        col === "owner_id" ||
        col === "created_by" ||
        col === "updated_by" ||
        col === "invited_by"
      ) {
        return resolveUser(str);
      }
      if (col === "project_id" || col === "project") {
        return resolveProject(str);
      }
      return str;
    },
    [resolveUser, resolveProject],
  );

  // Покажем `version` в зависимостях ниже, чтобы компонент перерисовался
  // при подгрузке нового email.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memo = useMemo(
    () => ({
      ready: cache?.loaded ?? false,
      resolveUser,
      resolveProject,
      userOptions,
      projectOptions,
      resolveCell,
    }),
    [cache?.loaded, resolveUser, resolveProject, userOptions, projectOptions, resolveCell, version],
  );

  return memo;
}

// ── Column label localization ────────────────────────────────

const COLUMN_LABELS: Record<Locale, Record<string, string>> = {
  ru: {
    user_id: "Пользователь",
    assignee_id: "Исполнитель",
    reporter_id: "Постановщик",
    owner_id: "Владелец",
    created_by: "Создал",
    updated_by: "Изменил",
    invited_by: "Пригласил",
    project_id: "Проект",
    sprint_id: "Спринт",
    epic_id: "Эпик",
    status: "Статус",
    status_id: "Статус (ID)",
    priority: "Приоритет",
    task_type: "Тип задачи",
    completed: "Завершена",
    created_at: "Дата создания",
    updated_at: "Дата обновления",
    due_date: "Срок",
    start_date: "Начало",
    end_date: "Окончание",
    count: "Количество",
    sum: "Сумма",
    avg: "Среднее",
    min: "Минимум",
    max: "Максимум",
    bucket: "Период",
  },
  en: {
    user_id: "User",
    assignee_id: "Assignee",
    reporter_id: "Reporter",
    owner_id: "Owner",
    created_by: "Created by",
    updated_by: "Updated by",
    invited_by: "Invited by",
    project_id: "Project",
    sprint_id: "Sprint",
    epic_id: "Epic",
    status: "Status",
    status_id: "Status (ID)",
    priority: "Priority",
    task_type: "Task type",
    completed: "Completed",
    created_at: "Created at",
    updated_at: "Updated at",
    due_date: "Due date",
    start_date: "Start",
    end_date: "End",
    count: "Count",
    sum: "Sum",
    avg: "Average",
    min: "Minimum",
    max: "Maximum",
    bucket: "Period",
  },
  de: {
    user_id: "Benutzer",
    assignee_id: "Zugewiesen",
    reporter_id: "Reporter",
    owner_id: "Inhaber",
    created_by: "Erstellt von",
    updated_by: "Aktualisiert von",
    invited_by: "Eingeladen von",
    project_id: "Projekt",
    sprint_id: "Sprint",
    epic_id: "Epic",
    status: "Status",
    status_id: "Status (ID)",
    priority: "Priorität",
    task_type: "Aufgabentyp",
    completed: "Abgeschlossen",
    created_at: "Erstellt am",
    updated_at: "Aktualisiert am",
    due_date: "Fälligkeit",
    start_date: "Start",
    end_date: "Ende",
    count: "Anzahl",
    sum: "Summe",
    avg: "Durchschnitt",
    min: "Minimum",
    max: "Maximum",
    bucket: "Zeitraum",
  },
};

/**
 * Возвращает человекочитаемую подпись колонки. Для ID-колонок и
 * стандартных метрик подбирает локализованный лейбл; иначе возвращает
 * сам ключ как есть.
 */
export function humanColumnLabel(column: string, locale: Locale): string {
  const dict = COLUMN_LABELS[locale];
  if (dict[column]) return dict[column];
  // common_metric_alias паттерны: "count_*", "sum_*"
  const lower = column.toLowerCase();
  for (const key of Object.keys(dict)) {
    if (lower.startsWith(`${key}_`)) return dict[key];
  }
  return column;
}

/**
 * Возвращает true, если имя колонки выглядит как идентификатор
 * пользователя или проекта, который нужно резолвить.
 */
export function isIdLikeColumn(column: string): boolean {
  const c = column.toLowerCase();
  return (
    c === "user_id" ||
    c === "assignee_id" ||
    c === "reporter_id" ||
    c === "owner_id" ||
    c === "created_by" ||
    c === "updated_by" ||
    c === "invited_by" ||
    c === "project_id" ||
    c === "project"
  );
}

/**
 * Применяет `resolver.resolveCell` ТОЛЬКО к значениям в ID-колонках
 * (`user_id`, `assignee_id`, `project_id` и т.п.). Остальные значения
 * (метрики, даты, прочие строки) проходят как есть, чтобы не ломать
 * `toNumber()` в чартах.
 */
export function useResolvedResult(
  result: AnalyticsResult | null,
  resolver: LabelResolver,
): AnalyticsResult | null {
  return useMemo(() => {
    if (!result) return null;
    const idCols = result.columns.filter(isIdLikeColumn);
    if (idCols.length === 0) return result;
    return {
      ...result,
      rows: result.rows.map((r) => {
        const next: Record<string, unknown> = { ...r.values };
        for (const c of idCols) {
          next[c] = resolver.resolveCell(c, r.values[c]);
        }
        return { values: next };
      }),
    };
  }, [result, resolver]);
}
