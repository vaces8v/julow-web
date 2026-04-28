/**
 * Локальное хранилище модуля «Сегодня».
 *
 * Видимость: stand-up и presence привязаны к workspaceId — в одном workspace
 * все записи в одном сегменте данных (как «участники workspace» в продукте).
 * В офлайн-демо коллеги симулируются seed-записями; в проде — API с ACL по workspace.
 */

import type {
  FocusSlots,
  PresenceEntry,
  StandUpPost,
  TodayDayState,
  TodayWorkspaceBundle,
} from "./today-types";
import { LOCAL_USER_ID, dayKeyFromDate, defaultDayState, emptyFocusSlots } from "./today-types";

const STORAGE_PREFIX = "julow-today-v1";

function bundleKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}`;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadBundle(workspaceId: string): TodayWorkspaceBundle {
  if (typeof window === "undefined") {
    return { days: {}, standUps: [], presence: [] };
  }
  const parsed = safeParse<TodayWorkspaceBundle>(localStorage.getItem(bundleKey(workspaceId)));
  if (!parsed) {
    return { days: {}, standUps: [], presence: seedPresenceDemo() };
  }
  return {
    days: parsed.days ?? {},
    standUps: parsed.standUps ?? [],
    presence: mergePresence(parsed.presence),
  };
}

function mergePresence(existing: PresenceEntry[] | undefined): PresenceEntry[] {
  const list = existing?.length ? [...existing] : [...seedPresenceDemo()];
  const byUser = new Map<string, PresenceEntry>();
  for (const p of list) byUser.set(p.userId, p);
  return Array.from(byUser.values());
}

/** Демо-коллеги для визуала команды; сбрасываются при отсутствии локальных данных. */
function seedPresenceDemo(): PresenceEntry[] {
  const t = Date.now();
  return [
    { userId: "u-demo-1", userName: "Marina", preset: "deep_work", updatedAt: t },
    { userId: "u-demo-2", userName: "Alex", preset: "meeting", updatedAt: t },
  ];
}

export function saveBundle(workspaceId: string, bundle: TodayWorkspaceBundle) {
  try {
    localStorage.setItem(bundleKey(workspaceId), JSON.stringify(bundle));
  } catch {
    /* quota */
  }
}

export function getDayState(bundle: TodayWorkspaceBundle, dayKey: string): TodayDayState {
  return bundle.days[dayKey] ?? defaultDayState();
}

export function setDayState(
  workspaceId: string,
  bundle: TodayWorkspaceBundle,
  dayKey: string,
  patch: Partial<TodayDayState>,
): TodayWorkspaceBundle {
  const prev = bundle.days[dayKey] ?? defaultDayState();
  const next: TodayWorkspaceBundle = {
    ...bundle,
    days: {
      ...bundle.days,
      [dayKey]: { ...prev, ...patch },
    },
  };
  saveBundle(workspaceId, next);
  return next;
}

export function setFocusSlots(
  workspaceId: string,
  bundle: TodayWorkspaceBundle,
  dayKey: string,
  slots: FocusSlots,
): TodayWorkspaceBundle {
  return setDayState(workspaceId, bundle, dayKey, { focusSlots: slots });
}

export function upsertMyStandUp(
  workspaceId: string,
  bundle: TodayWorkspaceBundle,
  dayKey: string,
  body: { yesterday: string; today: string; blockers: string },
  userName: string,
): TodayWorkspaceBundle {
  const id = `su-${LOCAL_USER_ID}-${dayKey}`;
  const filtered = bundle.standUps.filter(
    (s) => !(s.dayKey === dayKey && s.userId === LOCAL_USER_ID),
  );
  const post: StandUpPost = {
    id,
    workspaceId,
    dayKey,
    userId: LOCAL_USER_ID,
    userName,
    yesterday: body.yesterday,
    today: body.today,
    blockers: body.blockers,
    createdAt: new Date().toISOString(),
  };
  const next: TodayWorkspaceBundle = {
    ...bundle,
    standUps: [post, ...filtered],
    days: {
      ...bundle.days,
      [dayKey]: {
        ...(bundle.days[dayKey] ?? defaultDayState()),
        myStandUp: body,
      },
    },
  };
  saveBundle(workspaceId, next);
  return next;
}

export function setPresenceSelf(
  workspaceId: string,
  bundle: TodayWorkspaceBundle,
  preset: PresenceEntry["preset"],
  taskId?: string,
): TodayWorkspaceBundle {
  const me: PresenceEntry = {
    userId: LOCAL_USER_ID,
    userName: "You",
    preset,
    taskId,
    updatedAt: Date.now(),
  };
  const others = bundle.presence.filter((p) => p.userId !== LOCAL_USER_ID);
  const next: TodayWorkspaceBundle = {
    ...bundle,
    presence: [me, ...others],
  };
  saveBundle(workspaceId, next);
  return next;
}

export function standUpsForDay(bundle: TodayWorkspaceBundle, dayKey: string): StandUpPost[] {
  return bundle.standUps.filter((s) => s.dayKey === dayKey).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export { dayKeyFromDate, emptyFocusSlots };
