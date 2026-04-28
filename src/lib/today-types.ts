/**
 * Модель модуля «Сегодня»: фокус на задачах workspace, stand-up, статусы, сессия таймера.
 * Данные привязаны к workspaceId — видимость командного слоя совпадает с участниками workspace (см. today-storage).
 */

import type { TaskPayload } from "./api";

export const TODAY_FOCUS_MAX = 3;
export const LOCAL_USER_ID = "local-user";

/** Слоты фокуса — до TODAY_FOCUS_MAX id задач (null = пусто). */
export type FocusSlots = [string | null, string | null, string | null];

export type PresencePreset = "deep_work" | "meeting" | "need_help" | "available";

export type FocusSessionState = {
  taskId: string;
  /** Длительность сессии в секундах (например 25*60). */
  targetSeconds: number;
  accumulatedSeconds: number;
  segmentStartedAt: number | null;
};

export type StandUpPost = {
  id: string;
  workspaceId: string;
  /** Календарный день в локальной TZ YYYY-MM-DD */
  dayKey: string;
  userId: string;
  userName: string;
  yesterday: string;
  today: string;
  blockers: string;
  createdAt: string;
};

export type PresenceEntry = {
  userId: string;
  userName: string;
  preset: PresencePreset;
  taskId?: string;
  /** epoch ms — сброс в UI в конце дня */
  updatedAt: number;
};

export type TodayDayState = {
  focusSlots: FocusSlots;
  /** Task IDs checked off as done today (local, doesn't touch the board) */
  doneTaskIds: string[];
  /** Заметка к итогу дня */
  dayNote: string;
  /** Мой stand-up за этот день (если заполнен) */
  myStandUp?: { yesterday: string; today: string; blockers: string };
  presence?: { preset: PresencePreset; taskId?: string };
  focusSession: FocusSessionState | null;
};

export type TodayWorkspaceBundle = {
  /** Ключ dayKey → состояние дня текущего пользователя */
  days: Record<string, TodayDayState>;
  /** Все stand-up посты по workspace (видят участники workspace) */
  standUps: StandUpPost[];
  /** Статусы «сейчас» — только демо-коллеги + я; в проде — с сервера */
  presence: PresenceEntry[];
};

export function dayKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyFocusSlots(): FocusSlots {
  return [null, null, null];
}

export function defaultDayState(): TodayDayState {
  return {
    focusSlots: emptyFocusSlots(),
    doneTaskIds: [],
    dayNote: "",
    focusSession: null,
  };
}

export type TaskOption = TaskPayload & { projectName: string };
