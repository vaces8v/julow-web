"use client";

import { Button } from "@heroui/react";
import {
  Add01Icon,
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  BubbleChatIcon,
  ArrowRight01Icon,
  Call02Icon,
  Cancel01Icon,
  ColorsIcon,
  Copy01Icon,
  DashboardCircleIcon,
  File02Icon,
  Folder02Icon,
  Logout01Icon,
  Menu01Icon,
  Moon02Icon,
  Notification01Icon,
  PencilEdit01Icon,
  PinOffIcon,
  Search01Icon,
  Settings01Icon,
  Sun01Icon,
  UserCircleIcon,
} from "hugeicons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  applyTheme,
  readTheme,
  subscribeSystemTheme,
  type Theme,
} from "@/lib/theme";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { WorkspaceShellProvider, useWorkspaceShell } from "@/components/workspace-shell-context";
import { useAuth } from "@/components/auth/auth-context";
import { useI18n } from "@/i18n/context";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { HeaderSearch } from "@/components/header-search";
import { api, type NotificationPayload, type NotificationWsEvent, type ProjectPayload } from "@/lib/api";
import { useNotificationsSocket } from "@/lib/use-notifications-socket";
import { dispatchWsEvent } from "@/lib/ws-client";
import { PinProjectDialog } from "@/components/pin-project-dialog";
import { toast } from "@/components/ui/toast";
import { getActiveChatId } from "@/lib/active-chat";

type AppShellProps = {
  children: React.ReactNode;
};

const mainNavKeys = [
  { href: "/workspace", key: "dashboard" as const, icon: DashboardCircleIcon },
  { href: "/analytics", key: "insights" as const, icon: Analytics01Icon },

  { href: "/projects", key: "project" as const, icon: Folder02Icon },
  { href: "/chats", key: "chats" as const, icon: BubbleChatIcon },
  { href: "/documents", key: "document" as const, icon: File02Icon },
  { href: "/settings", key: "setting" as const, icon: Settings01Icon },
];

const toolNavKeys = [{ href: "/meetings", key: "meetings" as const, icon: Call02Icon }];

const TAB_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

/* ── Sidebar brand: static J icon + JULOW with hover letter bounce ── */
const BRAND_LETTERS = ["J", "U", "L", "O", "W"];

function BrandLogo({ onClose }: { onClose: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-2.5 px-3 mb-8"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground text-sm font-bold">
        J
      </div>
      <span
        className="flex items-baseline text-lg font-bold tracking-tight leading-none"
        style={{ fontFamily: "var(--font-inter), sans-serif" }}
      >
        {BRAND_LETTERS.map((letter, i) => (
          <motion.span
            key={letter}
            initial={false}
            animate={
              hovered
                ? {
                  y: [0, -(3 + (i % 3) * 2), 0],
                  transition: {
                    duration: 0.5 + i * 0.06,
                    delay: i * 0.05,
                    ease: [0.22, 1, 0.36, 1],
                  },
                }
                : { y: 0, transition: { duration: 0 } }
            }
            className="inline-block"
          >
            {letter}
          </motion.span>
        ))}
      </span>
      <button
        type="button"
        className="ml-auto lg:hidden text-muted hover:text-foreground"
        onClick={onClose}
      >
        <Cancel01Icon size={18} />
      </button>
    </div>
  );
}

/* ── Notification BC: display helpers ──
 *
 * UI работает с моделью бэкенда (`NotificationPayload`). Здесь — чисто
 * презентационные функции: классификация типа уведомления в одну из пяти
 * визуальных категорий, форматирование относительного времени, имя
 * отправителя из инициалов и т.п.
 */

type NotifVisualType = "mention" | "task" | "comment" | "deadline" | "system";

/** Сводит `notification_type` (произвольная строка от backend) к одной из
 *  визуальных категорий, под которые есть иконки/цвета. */
function classifyNotifType(rawType: string): NotifVisualType {
  const t = rawType.toLowerCase();
  if (t.includes("mention")) return "mention";
  if (t.includes("comment")) return "comment";
  if (t.includes("deadline") || t.includes("overdue") || t.includes("due"))
    return "deadline";
  if (t.includes("task") || t.includes("assign")) return "task";
  return "system";
}

/** Человекочитаемое время «N мин назад / N ч назад / N дн назад / только что». */
function formatRelativeTime(
  iso: string | undefined,
  labels: ReturnType<typeof useI18n>["t"]["notifications"],
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffSec = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return labels.timeNow;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return labels.timeMinutes.replace("{n}", String(diffMin));
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return labels.timeHours.replace("{n}", String(diffHr));
  const diffDay = Math.floor(diffHr / 24);
  return labels.timeDays.replace("{n}", String(diffDay));
}

/**
 * Визуальная мета по категории уведомления — цвет аватара/значка.
 *
 * Для `comment` раньше тут был `"💬"` (эмодзи), что выглядело инородно:
 * рисуется системным шрифтом эмодзи и выпадает из ритма UI (другой
 * baseline и цвет). Теперь рисуем настоящий иконочный SVG (hugeicons),
 * как и для категории `system`. `label` оставляем пустым — компонент
 * `NotifAvatar` сам рендерит подходящий значок.
 */
const NOTIF_META: Record<NotifVisualType, { bg: string; fg: string; label: string }> = {
  mention: { bg: "bg-violet-500/12", fg: "text-violet-500", label: "@" },
  task: { bg: "bg-accent/10", fg: "text-accent", label: "✓" },
  comment: { bg: "bg-emerald-500/10", fg: "text-emerald-500", label: "" },
  deadline: { bg: "bg-red-500/10", fg: "text-red-500", label: "!" },
  system: { bg: "bg-surface-secondary", fg: "text-foreground/60", label: "·" },
};

/** I18n-ключ для бейджа категории. Отделён от NOTIF_META, чтобы у меты
 *  не было зависимости от формы `Translations`. */
const NOTIF_BADGE_KEY: Record<NotifVisualType, keyof ReturnType<typeof useI18n>["t"]["notifications"]> = {
  mention: "typeMention",
  task: "typeTask",
  comment: "typeComment",
  deadline: "typeDeadline",
  system: "typeSystem",
};

/* Shared spring config */
const SPRING = { type: "spring" as const, stiffness: 380, damping: 38 };

/** List ↔ detail slide: `custom` is +1 (forward) or -1 (back) from AnimatePresence */
const NOTIF_LIST_VARIANTS = {
  enter: (d: number) => ({ x: d > 0 ? 0 : "-100%" }),
  center: { x: "0%" },
  leave: (d: number) => ({ x: d > 0 ? "-100%" : 0 }),
};


/**
 * Аватар уведомления.
 *
 * Если у уведомления есть actorId — рисуем «инициалы» (первые 2 символа
 * UUID), иначе используем визуальный значок категории (`✓` / `@` / `!` ...).
 * Цвет фона зависит от категории.
 */
function NotifAvatar({
  notif,
  size = 9,
  isDark = false,
}: {
  notif: NotificationPayload;
  size?: number;
  isDark?: boolean;
}) {
  const visual = classifyNotifType(notif.notificationType);
  const meta = NOTIF_META[visual];
  const cls = `flex shrink-0 items-center justify-center rounded-xl text-xs font-bold`;
  const sz = `h-${size} w-${size}`;
  
  // Для светлой темы используем более темные цвета
  const fgColor = visual === "system" 
    ? (isDark ? "text-muted" : "text-foreground/60")
    : meta.fg;
  
  // Внутренний контент аватара зависит от категории:
  //  - `deadline`: восклицательный знак (визуально сильнее, чем иконка).
  //  - `system`:   стандартная иконка-«колокольчик».
  //  - `comment`:  иконка чата (вместо `💬`-эмодзи, чтобы не выпадать
  //                из ритма UI и не зависеть от системного шрифта эмодзи).
  //  - остальные:  короткий текстовый label из `NOTIF_META` (`@`, `✓`).
  const iconSize = size === 9 ? 15 : 20;
  return (
    <div className={`${cls} ${sz} ${meta.bg} ${fgColor}`}>
      {visual === "deadline" && <span className="text-base leading-none">!</span>}
      {visual === "system" && (
        <Notification01Icon size={iconSize} strokeWidth={1.8} />
      )}
      {visual === "comment" && (
        <BubbleChatIcon size={iconSize} strokeWidth={1.8} />
      )}
      {visual !== "deadline" && visual !== "system" && visual !== "comment" && (
        <span>{meta.label}</span>
      )}
    </div>
  );
}

/**
 * Боковая панель уведомлений.
 *
 * Источник данных — `api.getNotifications` (Notification BC). На фронте
 * хранится только локальный snapshot, чтобы оптимистично применять
 * `markRead` / `archive` без ожидания ответа сервера. Если API упало,
 * откатывать состояние не пытаемся: данные подтянутся на следующем
 * открытии шита.
 *
 * Архитектурно панель работает как «модалка», поэтому fetch делается
 * именно на открытии (через монтирование), а не при загрузке приложения.
 * Это разгружает первую отрисовку и избавляет от лишних запросов на
 * страницах, где пользователь не открывает уведомления.
 */
function NotificationsSheet({
  onClose,
  isDark,
  refreshSignal,
}: {
  open?: boolean;
  onClose: () => void;
  isDark: boolean;
  /**
   * Счётчик, который AppShell бампает каждый раз при получении WS-события
   * (`notification.created` / `read` / …). Sheet наблюдает за ним как за
   * зависимостью useEffect, чтобы перетянуть список в фоне без участия
   * пользователя. На первый рендер (mount) тоже отрабатывает.
   */
  refreshSignal: number;
}) {
  const { t } = useI18n();
  const labels = t.notifications;
  const router = useRouter();

  const [items, setItems] = useState<NotificationPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);

  // Первый mount → loading=true. На последующие refresh'ы (по WS) не показываем
  // спиннер: список перетягивается тихо, чтобы UI не моргал на каждое событие.
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    if (isFirstLoadRef.current) {
      setLoading(true);
      setLoadError(false);
    }
    api
      .getNotifications({ limit: 50 })
      .then((list) => {
        if (cancelled) return;
        // Дополнительная защита: иногда backend возвращает архивные,
        // если фильтр не применён — отфильтровываем тут.
        setItems(list.filter((n) => !n.isArchived && !n.notificationType.toLowerCase().includes("invitation")));
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled && isFirstLoadRef.current) setLoadError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        isFirstLoadRef.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  const unreadCount = items.filter((n) => !n.isRead).length;
  const visible = filter === "unread" ? items.filter((n) => !n.isRead) : items;
  const selected = items.find((n) => n.id === selectedId) ?? null;

  const markAllRead = async () => {
    setItems((prev) =>
      prev.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: new Date().toISOString() })),
    );
    try {
      await api.markAllNotificationsRead();
    } catch (err) {
      console.error("markAllNotificationsRead failed:", err);
    }
  };

  const markRead = async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
    );
    try {
      await api.markNotificationRead(id);
    } catch (err) {
      console.error("markNotificationRead failed:", err);
    }
  };

  const dismiss = async (id: string) => {
    // Закрытие = «прочитано» + «архив». Если ещё не прочитано — помечаем
    // прочитанным до архивации, чтобы счётчик unread обновился корректно.
    const item = items.find((n) => n.id === id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      if (item && !item.isRead) {
        await api.markNotificationRead(id).catch(() => undefined);
      }
      await api.archiveNotification(id);
    } catch (err) {
      console.error("archiveNotification failed:", err);
    }
  };

  /**
   * Локальный state действий по invitation-уведомлению (sent → accepted/declined).
   *
   * Зачем: backend пришлёт два разных notification'а (одно invitee'у,
   * другое inviter'у), но конкретно карточка приглашения у invitee должна
   * мгновенно отреагировать на клик: показать loading, дисейблить
   * обе кнопки, потом скрыть их и оставить статус-строку.
   *
   * - `inviteAction`: какая операция в полёте (для disable+spinner);
   * - `inviteError`: текст ошибки (e.g. «не удалось», «приглашение уже
   *    отозвано»);
   * - `resolvedInvites`: id'ы уведомлений, которые в текущей сессии уже
   *    приняты/отклонены — чтобы оптимистично скрыть accept/decline-кнопки.
   *    Хранится в map id → 'accepted' | 'declined' для подходящей подписи.
   */
  const [inviteAction, setInviteAction] = useState<null | "accepting" | "declining">(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [resolvedInvites, setResolvedInvites] = useState<
    Record<string, "accepted" | "declined">
  >({});

  // Сбрасываем error при переключении просматриваемого уведомления.
  useEffect(() => {
    setInviteError(null);
    setInviteAction(null);
  }, [selectedId]);

  /**
   * Принять приглашение в проект из карточки уведомления.
   *
   * Поток:
   *   1. POST `/project-invitations/{id}/accept` → 200 = пользователь
   *      теперь member проекта.
   *   2. Помечаем notification прочитанным.
   *   3. Оптимистично выставляем `resolvedInvites[notif.id] = "accepted"`.
   *   4. Делаем редирект в `/projects/<projectId>` — пользователь сразу
   *      видит проект, к которому его пригласили.
   */
  const acceptInvite = async (notif: NotificationPayload) => {
    const data = notif.data ?? {};
    const invitationId = data.invitation_id;
    if (typeof invitationId !== "string" || !invitationId) return;
    const projectId = typeof data.project_id === "string" ? data.project_id : "";
    const workspaceId = typeof data.workspace_id === "string" ? data.workspace_id : "";
    const orgId = typeof data.org_id === "string" ? data.org_id : "";
    setInviteAction("accepting");
    setInviteError(null);
    try {
      let redirectTo: string | null = null;
      if (projectId) {
        const result = await api.acceptProjectInvitation(invitationId);
        redirectTo = `/projects/${result.projectId}`;
      } else if (workspaceId) {
        await api.acceptWorkspaceInvitation(invitationId);
        redirectTo = `/workspace`;
      } else if (orgId) {
        await api.acceptOrgInvitation(invitationId);
        redirectTo = `/workspace`;
      } else {
        // Fallback на старое поведение для обратной совместимости.
        const result = await api.acceptProjectInvitation(invitationId);
        redirectTo = `/projects/${result.projectId}`;
      }
      setResolvedInvites((prev) => ({ ...prev, [notif.id]: "accepted" }));
      if (!notif.isRead) void markRead(notif.id);
      onClose();
      if (redirectTo) router.push(redirectTo);
      // Полный refresh, чтобы WorkspaceShellProvider перечитал список
      // проектов и workspace'ов (как в /invite/[token] flow).
      router.refresh();
    } catch (err) {
      console.error("acceptInvitation failed:", err);
      setInviteError(err instanceof Error ? err.message : labels.detailInviteError);
    } finally {
      setInviteAction(null);
    }
  };

  /**
   * Отклонить приглашение. После отказа кнопки исчезают, остаётся только
   * статус-строка. Уведомление inviter'у создаст backend (см.
   * `OnProjectInvitationDeclinedNotify`).
   */
  const declineInvite = async (notif: NotificationPayload) => {
    const data = notif.data ?? {};
    const invitationId = data.invitation_id;
    if (typeof invitationId !== "string" || !invitationId) return;
    const projectId = typeof data.project_id === "string" ? data.project_id : "";
    const workspaceId = typeof data.workspace_id === "string" ? data.workspace_id : "";
    const orgId = typeof data.org_id === "string" ? data.org_id : "";
    setInviteAction("declining");
    setInviteError(null);
    try {
      if (projectId) {
        await api.declineProjectInvitation(invitationId);
      } else if (workspaceId) {
        await api.declineWorkspaceInvitation(invitationId);
      } else if (orgId) {
        await api.declineOrgInvitation(invitationId);
      } else {
        await api.declineProjectInvitation(invitationId);
      }
      setResolvedInvites((prev) => ({ ...prev, [notif.id]: "declined" }));
      if (!notif.isRead) void markRead(notif.id);
    } catch (err) {
      console.error("declineInvitation failed:", err);
      setInviteError(err instanceof Error ? err.message : labels.detailInviteError);
    } finally {
      setInviteAction(null);
    }
  };

  /**
   * Перейти к связанной задаче/проекту из уведомления.
   *
   * Источники task_id / project_id в `data` (в порядке приоритета):
   *   1. `data.task_id` / `data.project_id` — заполняет современный backend
   *      (`OnCommentAddedNotify`, `OnTaskAssignedNotify`, …).
   *   2. `data.target_type` === "task" → используем `data.target_id` как
   *      task_id. Это fallback для уведомлений-комментариев старого
   *      формата, до того как backend стал явно класть `task_id` в data.
   *      Аналогично "project" → `target_id` = project_id.
   *
   * Алгоритм:
   *   - Если project_id известен → редиректим на `/projects/<p>?task=<t>`.
   *   - Если только task_id → тянем task, чтобы узнать его project_id.
   *   - Иначе — ничего не делаем (нет данных для навигации).
   */
  const goToRelated = async (notif: NotificationPayload) => {
    if (!notif.isRead) void markRead(notif.id);
    const targetType = (notif.data?.target_type as string | undefined) ?? "";
    const targetId = (notif.data?.target_id as string | undefined) ?? undefined;
    const taskId =
      (notif.data?.task_id as string | undefined) ??
      (targetType === "task" ? targetId : undefined);
    const projectIdInData =
      (notif.data?.project_id as string | undefined) ??
      (targetType === "project" ? targetId : undefined);
    // Chat-уведомления (chat_message / chat_member_added) кладут
    // `chat_id` в data — открываем `/chats?chat=<id>` (см. chats-page.tsx,
    // который читает этот query-param при mount).
    const chatId = (notif.data?.chat_id as string | undefined) ?? undefined;
    onClose();
    if (chatId) {
      router.push(`/chats?chat=${chatId}`);
      return;
    }
    if (projectIdInData) {
      const url = taskId
        ? `/projects/${projectIdInData}?task=${taskId}`
        : `/projects/${projectIdInData}`;
      router.push(url);
      return;
    }
    if (!taskId) return;
    try {
      const task = await api.getTask(taskId);
      router.push(`/projects/${task.projectId}?task=${taskId}`);
    } catch (err) {
      console.error("goToRelated: failed to resolve project for task", err);
    }
  };

  const openDetail = (id: string) => {
    setDir(1);
    setSelectedId(id);
    const item = items.find((n) => n.id === id);
    if (item && !item.isRead) void markRead(id);
  };

  const closeDetail = () => {
    setDir(-1);
    setSelectedId(null);
  };

  const borderCls = isDark ? "border-border" : "border-border/40";
  const subText = isDark ? "text-white/40" : "text-muted";
  const hoverBg = isDark ? "hover:bg-white/4" : "hover:bg-surface-secondary/50";

  return (
    <motion.div
      key="notif-sheet"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 40 }}
      className={`fixed top-0 right-0 z-100 h-dvh w-[380px] max-w-[100vw] overflow-hidden rounded-l-2xl ${isDark ? "bg-surface border-l border-border" : "bg-white border-l border-border/40"} shadow-2xl`}
    >
      <AnimatePresence mode="popLayout" custom={dir} initial={false}>
        {!selected ? (
          /* ── LIST VIEW ───────────────────────────────────────────────── */
          <motion.div
            key="list"
            custom={dir}
            variants={NOTIF_LIST_VARIANTS}
            initial="enter"
            animate="center"
            exit="leave"
            transition={SPRING}
            className="absolute inset-0 flex flex-col"
          >
            {/* Header */}
            <div className={`flex shrink-0 items-center justify-between px-5 py-4 border-b ${borderCls}`}>
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold">{labels.title}</span>
                {unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${isDark ? "text-white/50 hover:bg-white/6 hover:text-white/80" : "text-muted hover:bg-surface-secondary hover:text-foreground"}`}
                  >
                    {labels.markAllRead}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isDark ? "hover:bg-white/6 text-white/50" : "hover:bg-black/5 text-foreground/50"}`}
                >
                  <Cancel01Icon size={14} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className={`flex shrink-0 items-center gap-1 px-4 py-2 border-b ${isDark ? "border-border/60" : "border-border/30"}`}>
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${filter === f ? "bg-accent/10 text-accent" : `${subText} ${hoverBg}`}`}
                >
                  {f === "all" ? labels.filterAll : labels.filterUnread}
                  {f === "unread" && unreadCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isDark ? "bg-white/4" : "bg-surface-secondary"}`}>
                    <Notification01Icon size={22} strokeWidth={1.5} className={isDark ? "text-muted" : "text-foreground/40"} />
                  </div>
                  <p className={`text-sm font-medium ${subText}`}>{labels.loading}</p>
                </div>
              ) : loadError ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20">
                  <p className={`text-sm font-medium ${subText}`}>{labels.loadFailed}</p>
                </div>
              ) : visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isDark ? "bg-white/4" : "bg-surface-secondary"}`}>
                    <Notification01Icon size={22} strokeWidth={1.5} className={isDark ? "text-muted" : "text-foreground/40"} />
                  </div>
                  <p className={`text-sm font-medium ${subText}`}>
                    {filter === "unread" ? labels.emptyUnread : labels.emptyAll}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-(--border)/30">
                  <AnimatePresence initial={false}>
                    {visible.map((notif) => (
                      <motion.div
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, height: 0, y: -8 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -8 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => openDetail(notif.id)}
                        className={`group relative flex cursor-pointer items-start gap-3 overflow-hidden px-4 py-3.5 transition-colors ${hoverBg} ${!notif.isRead ? (isDark ? "bg-white/2" : "bg-accent/2") : ""}`}
                      >
                      {!notif.isRead && (
                        <span className="absolute left-2 top-[0.75rem] h-1.5 w-1.5 rounded-full bg-accent" />
                      )}
                      <div className="mt-0.5">
                        <NotifAvatar notif={notif} size={9} isDark={isDark} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`m-0 text-[13px] font-semibold leading-tight ${!notif.isRead ? "" : subText}`}
                        >
                          {notif.title}
                        </p>
                        <p
                          className={`m-0 mt-0.5 line-clamp-2 text-[12px] leading-relaxed ${isDark ? "text-white/35" : "text-muted/70"}`}
                        >
                          {notif.body}
                        </p>
                        <p
                          className={`m-0 mt-1 text-[11px] ${isDark ? "text-white/25" : "text-muted/50"}`}
                        >
                          {formatRelativeTime(notif.createdAt, labels)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void dismiss(notif.id);
                        }}
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 ${isDark ? "hover:bg-white/8 text-white/30" : "hover:bg-black/5 text-foreground/40"}`}
                      >
                        <Cancel01Icon size={11} strokeWidth={2} />
                      </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          /* ── DETAIL VIEW ─────────────────────────────────────────────── */
          <motion.div
            key={`detail-${selected.id}`}
            custom={dir}
            initial={{ x: "100%" }}
            animate={{ x: "0%" }}
            exit={{ x: "100%" }}
            transition={SPRING}
            className="absolute inset-0 flex flex-col"
          >
            {/* Detail header */}
            <div className={`flex shrink-0 items-center gap-3 px-4 py-4 border-b ${borderCls}`}>
              <button
                type="button"
                onClick={closeDetail}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${isDark ? "hover:bg-white/6 text-white/50" : "hover:bg-black/5 text-foreground/50"}`}
              >
                <ArrowLeft01Icon size={16} strokeWidth={2} />
              </button>
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider flex-1 ${subText}`}
              >
                {labels[NOTIF_BADGE_KEY[classifyNotifType(selected.notificationType)]]}
              </span>
              <button
                type="button"
                onClick={() => {
                  void dismiss(selected.id);
                  closeDetail();
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isDark ? "hover:bg-white/6 text-white/50 hover:text-white/70" : "hover:bg-black/5 text-foreground/50 hover:text-foreground"}`}
              >
                <Cancel01Icon size={13} strokeWidth={2} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-5 space-y-5">
                {/* Sender + meta */}
                <div className="flex items-start gap-3">
                  <NotifAvatar notif={selected} size={11} isDark={isDark} />
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-sm font-bold leading-tight">{labels.senderJulow}</p>
                    <p className={`m-0 mt-0.5 text-[11px] ${subText}`}>
                      {formatRelativeTime(selected.createdAt, labels)}
                    </p>
                  </div>
                  {!selected.isRead && (
                    <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                      {labels.filterUnread}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h2 className="m-0 text-base font-bold leading-snug">{selected.title}</h2>

                {/* Full body — email-style paragraphs */}
                <div
                  className={`text-sm leading-relaxed space-y-3 ${isDark ? "text-white/75" : "text-foreground/80"}`}
                >
                  {selected.body.split("\n\n").map((para: string, i: number) => (
                    <p key={i} className="m-0">{para}</p>
                  ))}
                </div>
              </div>
            </div>

            {/* Detail footer */}
            <div className={`shrink-0 border-t px-5 py-3.5 ${borderCls} space-y-2`}>
              {(() => {
                // Узнаём, является ли это invitation-уведомлением, которое
                // ещё ждёт реакции пользователя (т.е. `kind: "sent"` +
                // есть invitation_id, и не было локально resolved'нуто).
                const data = selected.data ?? {};
                const isInvite =
                  data.kind === "sent" &&
                  typeof data.invitation_id === "string" &&
                  !!data.invitation_id;
                const resolved = resolvedInvites[selected.id];
                if (isInvite && !resolved) {
                  const isAccepting = inviteAction === "accepting";
                  const isDeclining = inviteAction === "declining";
                  const busy = inviteAction !== null;
                  return (
                    <>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void acceptInvite(selected)}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-xs font-semibold text-accent-foreground transition-[filter] duration-150 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isAccepting
                            ? labels.detailAcceptingInvite
                            : labels.detailAcceptInvite}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void declineInvite(selected)}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${isDark ? "bg-white/6 text-white/70 hover:bg-white/10 hover:text-white/90" : "bg-surface-secondary text-foreground/70 hover:bg-surface-secondary/80 hover:text-foreground"}`}
                        >
                          {isDeclining
                            ? labels.detailDecliningInvite
                            : labels.detailDeclineInvite}
                        </button>
                      </div>
                      {inviteError && (
                        <p className="m-0 text-[11.5px] text-red-500">{inviteError}</p>
                      )}
                    </>
                  );
                }
                // Уже разрешённое invitation — статус-строка вместо кнопок.
                if (resolved) {
                  const text =
                    resolved === "accepted"
                      ? labels.detailInviteAccepted
                      : labels.detailInviteDeclined;
                  return (
                    <p
                      className={`m-0 rounded-xl px-3 py-2.5 text-center text-[12px] font-medium ${
                        resolved === "accepted"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : `${isDark ? "bg-white/4 text-white/55" : "bg-surface-secondary text-foreground/60"}`
                      }`}
                    >
                      {text}
                    </p>
                  );
                }
                // Не invitation — стандартная «View task/project/chat» CTA.
                const hasTask = typeof data.task_id === "string" && !!data.task_id;
                const hasProject = typeof data.project_id === "string" && !!data.project_id;
                const hasChat = typeof data.chat_id === "string" && !!data.chat_id;
                if (hasTask || hasProject || hasChat) {
                  // Приоритет: chat > task > project. Для chat-уведомлений
                  // (chat_message / chat_member_added) у нас нет ни task,
                  // ни project в data — есть только chat_id.
                  const ctaLabel = hasChat
                    ? labels.detailViewChat
                    : hasTask
                      ? labels.detailViewTask
                      : labels.detailViewProject;
                  return (
                    <button
                      type="button"
                      onClick={() => void goToRelated(selected)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-xs font-semibold text-accent-foreground transition-[filter] duration-150 hover:brightness-110"
                    >
                      {ctaLabel}
                    </button>
                  );
                }
                return null;
              })()}
              <button
                type="button"
                onClick={closeDetail}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium transition-colors ${isDark ? "bg-white/4 text-white/60 hover:bg-white/6 hover:text-white/80" : "bg-surface-secondary text-foreground/60 hover:bg-surface-secondary/80 hover:text-foreground"}`}
              >
                <ArrowLeft01Icon size={13} strokeWidth={2} />
                {labels.detailBack}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function AppShell({ children }: AppShellProps) {
  // AuthProvider монтируется один раз в app/layout.tsx выше по дереву.
  return (
    <WorkspaceShellProvider>
      <AppShellContent>{children}</AppShellContent>
    </WorkspaceShellProvider>
  );
}

/**
 * Хелпер: проверка, что таб соответствует реальному проекту, а не
 * локальной заглушке (`custom-N` / `dup-N`). Используется, чтобы решить,
 * нужно ли отправлять переименование/смену цвета на бэкенд.
 */
const isRealProjectTab = (tabId: string): boolean =>
  Boolean(tabId) && !tabId.startsWith("custom-") && !tabId.startsWith("dup-");

function AppShellContent({ children }: AppShellProps) {
  const {
    isInitialLoading,
    projects,
    allProjects,
    workspaces,
    activeWorkspaceId,
    activeProjectId,
    setActiveWorkspaceId,
    setActiveProjectId,
    createProject,
    renameProject,
    setProjectColor,
  } = useWorkspaceShell();
  const { logout, isAuthenticated, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  /*
   * Тема. Инициализируется ДЕТЕРМИНИРОВАННО ('light') и на SSR, и на
   * клиенте, чтобы SSR-разметка СОВПАДАЛА с первым клиентским
   * рендером (любой ленивый инициализатор с чтением `document` рискован:
   * в React 19 под время гидратации SSR-вычисленное значение иногда
   * «выигрывало» у клиентского, и state застревал в «light» при фактической
   * «dark»-теме — первый клик «ничего не делал»).
   *
   * Реальное значение приедет в useEffect ниже — явным
   * `setTheme(readTheme())` из DOM, выставленного blocking ThemeScript'ом.
   * Сам клик вызывает `toggleTheme()`, который ЧИТАЕТ текущую тему из
   * DOM (а не из React state) — и поэтому надёжен даже до завершения
   * первого sync-эффекта.
   */
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  /**
   * Список открытых табов — positive cross-workspace persisted список.
   *
   * Ключ `julow_open_tabs_v2` — v2 потому что мы заменили старый
   * negative-список (`julow_unpinned_tabs`) на positive: что в localStorage,
   * то и открыто после reload. Это устраняет три класса багов:
   *   1. Закрытие крестиком теряло проекты из чужого workspace при reload.
   *   2. Новые проекты на бэке автоматически открывались (могло быть
   *      неожиданно после долгого отсутствия пользователя).
   *   3. `unpinnedTabs` рос монотонно и неконсистентно с реальностью.
   */
  /**
   * Разделяем два case'a, выглядящих одинаково (openTabs=[]):
   *   - Новый user: localStorage пуст — нужен default-fill всеми проектами.
   *   - Старый user, закрывший все табы: localStorage содержит "[]" — уважаем
   *     этот выбор, не восстанавливаем табы.
   *
   * `hasStoredTabsRef.current = true` в lazy init = «в localStorage был
   * явный сохранённый список». hydration-effect ниже проверяет это
   * и не делает default-fill.
   */
  const hasStoredTabsRef = useRef(false);
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("julow_open_tabs_v2");
      if (stored !== null) {
        hasStoredTabsRef.current = true;
        return JSON.parse(stored) as string[];
      }
      // Очищаем legacy negative-список, чтобы не путал диагностику.
      localStorage.removeItem("julow_unpinned_tabs");
      return [];
    } catch { return []; }
  });
  const [tabNames, setTabNames] = useState<Record<string, string>>({});
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tabColors, setTabColors] = useState<Record<string, string>>({});
  const [ctxMenu, setCtxMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  /**
   * Диалог «Закрепить существующий проект» — выбор проекта из всех доступных
   * пользователю (cross-workspace), которого сейчас нет в открытых табах.
   * Открывается из dropdown в панели табов.
   */
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  /**
   * Счётчик непрочитанных уведомлений для бейджа на колокольчике.
   * Источник — `GET /notifications/unread-count`. Обновляется:
   *   1) при монтировании AppShell,
   *   2) каждые 30 секунд (лёгкий polling — WebSocket добавим отдельно),
   *   3) когда пользователь закрывает шторку (т.к. read-операции могли
   *      изменить число прочитанных).
   * Если бэкенд не отвечает или пользователь не залогинен — счётчик
   * молча остаётся 0, чтобы не плодить ошибок в консоли.
   */
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const editInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  /**
   * Ref на кнопку «▾» — из неё берём координаты для позиционирования
   * dropdown’а. Нужен, потому что родительский wrapper табов имеет
   * `overflow-x-auto` — это автоматически переключает `overflow-y` в `auto`,
   * и absolute-позиционированный dropdown обрезается. Поэтому рендерим
   * dropdown с `position: fixed` и явными координатами.
   */
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);
  /**
   * Ref на саму portal-панель dropdown'а. Нужен для click-outside:
   * так как dropdown рендерится в document.body, он НЕ содержится
   * в dropdownRef — без этого ref'а любой клик по пункту меню
   * считался бы "outside" и dropdown закрывался бы до onClick.
   */
  const dropdownPanelRef = useRef<HTMLDivElement>(null);
  /**
   * Таймер автозакрытия dropdown'а. Запускается, когда курсор уходит с
   * panel/триггера; отменяется при возврате. Также чистится при clean-
   * закрытии (клик по пункту меню / click-outside / scroll/resize), чтобы
   * stale timeout не закрыл только что переоткрытый dropdown.
   */
  const dropdownAutoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);
  const mainRef = useRef<HTMLDivElement>(null);
  /**
   * Ref на sticky-header — нужен для измерения его высоты и пробрасывания
   * её в CSS-переменную `--toast-top-offset`. Toaster (см. `ui/toast.tsx`)
   * читает эту переменную и сдвигается ровно под хедер, чтобы не закрывать
   * собой контролы справа (уведомления, профиль, switcher языка, темы,
   * поиск). Высота динамическая: header сжимается на scroll (`py-2` vs
   * `py-4`), поэтому используем ResizeObserver — об этом ниже в useEffect.
   */
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      const next = scrolledRef.current ? y > 5 : y > 30;
      if (next !== scrolledRef.current) {
        scrolledRef.current = next;
        setScrolled(next);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  /**
   * Прокидываем актуальную высоту хедера в CSS-переменную
   * `--toast-top-offset` на корневом `<html>`. Toaster читает её через
   * `style={{ top: 'var(--toast-top-offset, 0px)' }}` и опускается ровно
   * под хедер — иначе тосты справа налезают на колокольчик/профиль/
   * theme-toggle/локаль/поиск.
   *
   * Подписка через `ResizeObserver`, потому что header переключается
   * между `py-4` и `py-2` при scroll, и его высота меняется в анимации
   * (`transition-all duration-500`). Браузеры с `ResizeObserver` (>=2018)
   * увидят плавный пересчёт; для древних — fallback на одноразовое
   * измерение в `useEffect`-cleanup, чтобы хоть какое-то значение было.
   *
   * Чистим переменную при unmount (logout / выход в landing-группу),
   * чтобы там тосты снова прижимались к верху, как раньше.
   */
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof window === "undefined") return;
    const root = document.documentElement;
    const applyOffset = (h: number) => {
      // Раньше offset был ровно равен высоте хедера — но с собственным
      // `p-6` стэка (24px сверху) тосты «висели» слишком низко с большим
      // воздухом между ними и хедером. Срезаем 8px, чтобы первый тост
      // встал чуть ближе к нижней кромке хедера, не перекрывая её.
      const TOAST_LIFT = 8;
      root.style.setProperty(
        "--toast-top-offset",
        `${Math.max(0, Math.round(h) - TOAST_LIFT)}px`,
      );
    };
    applyOffset(el.getBoundingClientRect().height);
    // `getBoundingClientRect().height` включает border'ы (а `contentRect` —
    // нет). Header'у нужны именно полные границы, чтобы тост не пересёкся
    // с нижней разделяющей линией.
    const ro = new ResizeObserver(() => {
      applyOffset(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--toast-top-offset");
    };
  }, []);

  /**
   * Подписка на unread-count.
   *
   * Источник истины — WebSocket `/ws/notifications` (см.
   * `useNotificationsSocket` ниже). Любое серверное событие триггерит
   * фоновый refresh бейджа через `getUnreadNotificationsCount`.
   *
   * Полит-полит-полл (5 минут) оставлен как safety net на случай, если
   * WS не доехал или потерял сообщение в момент reconnect-окна. Это
   * дёшево и спасает от «мертвого» бейджа.
   */
  const refreshUnreadCount = useCallback(async () => {
    try {
      const payload = await api.getUnreadNotificationsCount();
      setUnreadNotifCount(payload.total);
    } catch {
      // Молча — например, 401 до авторизации
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    // refreshUnreadCount — async, setState идёт в then; правило
    // `react-hooks/set-state-in-effect` об этом не догадывается.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUnreadCount();
    const interval = setInterval(() => void refreshUnreadCount(), 5 * 60_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshUnreadCount]);

  // Дополнительный refresh при закрытии шторки: read/archive операции в
  // sheet'е могли сдвинуть число непрочитанных.
  useEffect(() => {
    if (notifOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUnreadCount();
  }, [notifOpen, refreshUnreadCount]);

  /**
   * Сигнал для NotificationsSheet, что пора перетянуть список.
   * Бампается на каждое WS-событие; sheet наблюдает за ним в useEffect.
   */
  const [notifRefreshSignal, setNotifRefreshSignal] = useState(0);

  // Live-обновления через WebSocket — заменяют необходимость частого polling.
  // Это ЕДИНСТВЕННОЕ WS-соединение на вкладку. Все остальные потребители
  // (например, `chats-page`) подписываются через `subscribeWsEvent` из
  // `@/lib/ws-client`, куда мы пробрасываем все события через
  // `dispatchWsEvent` ниже.
  useNotificationsSocket({
    enabled: isAuthenticated,
    onEvent: useCallback(
      (event: NotificationWsEvent) => {
        // 1) Раздаём событие всем подписчикам pub/sub-шины. Это запускает
        //    обработчики `notification.created`, `chat.message.created`
        //    и т.п. в других компонентах (`chats-page` и пр.).
        dispatchWsEvent(event.type, event.payload);

        // 2) Любое серверное событие обновляет счётчик. Делаем безусловно,
        //    т.к. event payload (`notification.created`) не несёт id, и
        //    доверять локальному ±1 опасно при параллельных вкладках.
        void refreshUnreadCount();
        // 3) Если sheet открыт — бампаем signal, чтобы перетянуть список.
        //    Иначе тоже бампаем, но это no-op для незамонтированного
        //    компонента.
        setNotifRefreshSignal((n) => n + 1);

        // 4) Bell-toast про новые уведомления. Шапка `notification.created`
        //    приходит с плоским payload'ом `{notification_type, title, body,
        //    ...data}` (см. `NotificationWsEvent` в @/lib/api). Для других
        //    event_type ничего не показываем — это служебные сигналы (read /
        //    all_read / archived), их UI и так подхватит через unread-badge
        //    и `dispatchWsEvent`.
        if (event.type === "notification.created") {
          const p = (event.payload ?? {}) as {
            notification_type?: string;
            title?: string;
            body?: string;
            chat_id?: string;
            project_id?: string;
            task_id?: string;
            data?: {
              chat_id?: string;
              project_id?: string;
              task_id?: string;
            };
          };
          const data = p.data ?? {};
          const chatId = data.chat_id ?? p.chat_id;
          const projectId = data.project_id ?? p.project_id;
          const taskId = data.task_id ?? p.task_id;
          const isChatMessage =
            (p.notification_type ?? "").toLowerCase() === "chat_message";

          // Не дёргаем тостом, если пользователь СЕЙЧАС читает этот чат —
          // он уже видит сообщение в ленте, дублирующее уведомление
          // только мешает (см. `lib/active-chat.ts`).
          if (isChatMessage && chatId && getActiveChatId() === chatId) {
            return;
          }

          // Контекстное «Перейти». Приоритет: chat → task → project →
          // открыть панель уведомлений (для всего, что не привязано к
          // конкретной сущности — invite/system/mention без deep-link'а).
          const goTo = () => {
            if (chatId) {
              router.push(`/chats?chat=${chatId}`);
              return;
            }
            if (taskId && projectId) {
              router.push(`/projects/${projectId}?task=${taskId}`);
              return;
            }
            if (projectId) {
              router.push(`/projects/${projectId}`);
              return;
            }
            // Fallback — открываем шторку уведомлений в самой шапке.
            setProfileOpen(false);
            setNotifOpen(true);
          };

          /**
           * Mark-as-read flow для НЕ-chat уведомлений (статусные:
           * task_assigned, task_status_changed, comment, deadline,
           * system и т.п.). WS-payload в `notification.created` НЕ
           * несёт id уведомления (см. `NotificationWsEvent` в
           * @/lib/api), поэтому id приходится восстанавливать через
           * подзапрос: тянем 5 самых свежих непрочитанных текущего
           * `notification_type` и матчим по `title` + `body`. Так как
           * WS-событие ТОЛЬКО что прилетело, искомое уведомление
           * почти наверняка будет в верхушке этого ответа.
           *
           * fire-and-forget — `ToastAction.onClick` синхронный, мы
           * не блокируем dismiss тоста; в случае сетевой ошибки
           * молча уходим (refreshUnreadCount при следующем WS
           * событии всё подровняет).
           */
          const markRead = () => {
            void (async () => {
              try {
                const items = await api.getNotifications({
                  type: p.notification_type,
                  isRead: false,
                  limit: 5,
                });
                const titleKey = p.title ?? "";
                const bodyKey = p.body ?? "";
                const match =
                  items.find(
                    (n) => n.title === titleKey && (n.body ?? "") === bodyKey,
                  ) ?? items[0];
                if (match) {
                  await api.markNotificationRead(match.id);
                  await refreshUnreadCount();
                  setNotifRefreshSignal((n) => n + 1);
                }
              } catch {
                /* silent — пользователь увидит реальное состояние
                   при следующем WS-тике / открытии sheet'а */
              }
            })();
          };

          // chat_message — это «новое сообщение», поведение прежнее:
          // и тело, и правая кнопка ведут в чат («Перейти»).
          // Всё остальное (статус задачи, упоминание, дедлайн, system) —
          // статусное уведомление: тело по-прежнему открывает сущность,
          // но правая кнопка превращается в «Прочитать», помечая
          // уведомление как прочитанное (без перехода).
          const action = isChatMessage
            ? { label: t.notifications.toastOpen, onClick: goTo }
            : { label: t.notifications.toastMarkRead, onClick: markRead };

          toast.notification(p.title ?? t.notifications.typeDefault, {
            description: p.body ?? undefined,
            action,
            onClick: goTo,
          });
        }
      },
      [
        refreshUnreadCount,
        router,
        t.notifications.toastOpen,
        t.notifications.toastMarkRead,
        t.notifications.typeDefault,
      ],
    ),
  });

  /*
   * Синхронизация React-state с реальным DOM (выставленным blocking-
   * скриптом). Нарочно НЕ мирорим «theme → DOM» с зависимостью
   * `[theme]` — это оверрайдило бы ThemeScript на первом пайнте,
   * выбрасывая data-theme="dark" обратно в "light" (из инициального
   * SSR-state). DOM мутирует только `applyTheme()` в toggle/system-listener.
   */
  useEffect(() => {
    setTheme(readTheme());
  }, []);

  /*
   * При смене системной темы (Win Auto-mode, macOS Auto Appearance) и при
   * ОТСУТСТВИИ явного выбора в localStorage — подхватываем новую тему.
   * Если пользователь ранее нажимал toggle и фиксировал выбор —
   * `subscribeSystemTheme` сам проверяет storage и молчит.
   */
  useEffect(() => {
    return subscribeSystemTheme((next) => {
      applyTheme(next);
      setTheme(next);
    });
  }, []);

  /**
   * Ручной toggle. Читает АКТУАЛЬНУЮ тему из DOM (а не React state),
   * инвертирует, применяет и сохраняет в localStorage. Надёжен даже до
   * завершения sync-effect'а — визуальный результат = смена того, что
   * пользователь видит сейчас.
   */
  const toggleTheme = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }, []);

  /**
   * Гидрация табов на первом запуске.
   *
   * Если в localStorage пусто (новый user или первый раз после перехода
   * на positive-хранилище) — открываем все проекты ТЕКУЩЕГО workspace
   * как табы по умолчанию. После этого hydration больше не вмешивается
   * — openTabs управляется только явными действиями пользователя
   * (addTab/closeTab/unpinTab/pinProject). Это устраняет «магическое»
   * появление табов после архивации/создания проектов на бэке другой
   * сессией.
   *
   * `hasHydratedTabsRef` гарантирует, что мы не повторим default-fill
   * после, например, archiveProject (когда openTabs может временно
   * стать пустым по другим причинам).
   */
  const hasHydratedTabsRef = useRef(false);
  useEffect(() => {
    if (hasHydratedTabsRef.current) return;
    // Default-fill нужен ТОЛЬКО для новых user'ов (в localStorage ничего не было).
    // Старый user, закрывший все табы, имеет stored="[]" — уважаем
    // этот выбор и НЕ восстанавливаем табы.
    if (hasStoredTabsRef.current) {
      hasHydratedTabsRef.current = true;
      return;
    }
    // Дожидаемся реального ответа бэка по проектам (allProjects может быть
    // [] во время первого фетча). Если у user'а вообще нет проектов в
    // активном workspace — всё равно помечаем «гидрировано», чтобы не
    // дублировать запуск при первом созданном проекте (он добавится сам
    // через addTab/pinProject).
    if (projects.length === 0) return;
    hasHydratedTabsRef.current = true;
    setOpenTabs(projects.map((p) => p.id));
  }, [projects]);

  /**
   * Чистка openTabs от удалённых/архивированных проектов.
   *
   * Когда `allProjects` меняется (фоновый refresh, удаление, архив) —
   * убираем из openTabs реальные проектные ID, которых больше нет на
   * бэке. Локальные `custom-`/`dup-` табы не трогаем (они никогда не
   * жили на бэке). Cross-workspace pinned проекты остаются, потому что
   * мы фильтруем по `allProjects`, а не по `projects` (filtered view).
   */
  useEffect(() => {
    if (allProjects.length === 0) return;
    const validIds = new Set(allProjects.map((p) => p.id));
    setOpenTabs((prev) => {
      const filtered = prev.filter(
        (id) =>
          id.startsWith("custom-") ||
          id.startsWith("dup-") ||
          validIds.has(id),
      );
      // Возвращаем тот же массив, если ничего не выбросили — иначе
      // спровоцируем лишний persistence-write.
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [allProjects]);

  /**
   * Persist openTabs в localStorage по новому positive-ключу.
   *
   * Сохраняем только реальные проектные ID (не `custom-`/`dup-`, потому
   * что они после reload всё равно невалидны — backend о них не знает).
   * Пишем каждый раз, когда openTabs меняется — это включает действия
   * addTab/closeTab/unpinTab/pinProject/duplicateActiveTab и automatic
   * cleanup от удалённых проектов.
   */
  useEffect(() => {
    try {
      const persistable = openTabs.filter(
        (id) => !id.startsWith("custom-") && !id.startsWith("dup-"),
      );
      localStorage.setItem("julow_open_tabs_v2", JSON.stringify(persistable));
    } catch {
      /* приватный режим / quota — ignore */
    }
  }, [openTabs]);

  /**
   * Закрыть локальный таб (`custom-`/`dup-` — те, что не существуют на бэке).
   * Для реальных проектных табов используем `unpinTab` ниже — он сохраняет
   * unpin в localStorage, чтобы после reload таб не возвращался.
   */
  const closeTab = (projectId: string) => {
    setOpenTabs((prev) => prev.filter((id) => id !== projectId));
    if (activeProjectId === projectId) {
      const remaining = openTabs.filter((id) => id !== projectId);
      setActiveProjectId(remaining[0] ?? "");
    }
  };

  const [tabIdSeq, setTabIdSeq] = useState(0);

  /**
   * «+» в панели табов: создаём реальный проект на бэке с локализованным
   * именем по умолчанию (`t.projects.newProject` = «Новый проект» / «New Project»
   * / «Neues Projekt»). При ошибке бэка fallback'имся к локальному `custom-`
   * табу, чтобы UI не подвисал.
   */
  const addTab = () => {
    const seq = tabIdSeq + 1;
    setTabIdSeq(seq);
    const defaultName = t.projects.newProject;
    void (async () => {
      try {
        const created = await createProject({ name: defaultName });
        setOpenTabs((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
        setActiveProjectId(created.id);
        router.push(`/projects/${created.id}`);
      } catch {
        // Backend недоступен — добавляем локальный таб с тем же именем.
        const id = `custom-${seq}`;
        setTabNames((prev) => ({ ...prev, [id]: defaultName }));
        setOpenTabs((prev) => [...prev, id]);
        setActiveProjectId(id);
      }
    })();
  };

  /**
   * Открепить таб реального проекта — проект остаётся, но таб скрывается
   * из панели. При новом positive-хранилище `julow_open_tabs_v2` это
   * просто удаление из `openTabs` — после reload таб не вернётся,
   * потому что в localStorage их больше нет. Персистенс делает
   * отдельный useEffect[openTabs] ниже.
   */
  const unpinTab = (projectId: string) => {
    setOpenTabs((prev) => prev.filter((id) => id !== projectId));
    if (activeProjectId === projectId) {
      const remaining = openTabs.filter((id) => id !== projectId);
      setActiveProjectId(remaining[0] ?? "");
    }
  };

  /**
   * Противоположная операция: пользователь выбрал проект в диалоге
   * «Закрепить существующий». Если проект из чужого workspace — переключаемся
   * туда (activeWorkspaceId persisted, таб переживёт reload). Добавляем в
   * `openTabs` идемпотентно (если уже есть — не дублируем) и делаем
   * активным.
   */
  const pinProject = (project: ProjectPayload) => {
    if (project.workspaceId && project.workspaceId !== activeWorkspaceId) {
      setActiveWorkspaceId(project.workspaceId);
    }
    setOpenTabs((prev) => (prev.includes(project.id) ? prev : [...prev, project.id]));
    setActiveProjectId(project.id);
    router.push(`/projects/${project.id}`);
  };

  const duplicateActiveTab = () => {
    if (!activeProjectId) return;
    const seq = tabIdSeq + 1;
    setTabIdSeq(seq);
    const id = `dup-${seq}`;
    const srcName = getTabName(activeProjectId);
    setTabNames((prev) => ({ ...prev, [id]: `${srcName} (copy)` }));
    setOpenTabs((prev) => [...prev, id]);
    setActiveProjectId(id);
    setDropdownOpen(false);
  };

  const startRenaming = (tabId: string) => {
    setEditingTabId(tabId);
    setEditingName(getTabName(tabId));
    setTimeout(() => editInputRef.current?.select(), 0);
  };

  const commitRename = () => {
    if (editingTabId && editingName.trim()) {
      const trimmed = editingName.trim();
      setTabNames((prev) => ({ ...prev, [editingTabId]: trimmed }));
      // Реальный проект — синхронизируем имя с бэком.
      if (isRealProjectTab(editingTabId)) {
        void renameProject(editingTabId, trimmed).catch(() => { /* откат в контексте */ });
      }
    }
    setEditingTabId(null);
  };

  const getTabName = (tabId: string) => {
    if (tabNames[tabId]) return tabNames[tabId];
    // Сначала ищем в проектах активного workspace; затем cross-workspace
    // fallback на случай, если активный workspace ещё не успел обновиться
    // после pinProject из чужого workspace.
    const project =
      projects.find((p) => p.id === tabId) ??
      allProjects.find((p) => p.id === tabId);
    if (project) return project.name;
    return t.shell.tabFallbackName;
  };

  const getTabColor = (tabId: string) => {
    const project =
      projects.find((p) => p.id === tabId) ??
      allProjects.find((p) => p.id === tabId);
    if (project?.color) return project.color;
    return undefined;
  };

  const closeAllTabs = () => {
    setOpenTabs([]);
    setActiveProjectId("");
    setDropdownOpen(false);
  };

  const closeOtherTabs = () => {
    if (!activeProjectId) return;
    setOpenTabs([activeProjectId]);
    setDropdownOpen(false);
  };

  // Click-outside для dropdown табов и контекстного меню + автозакрытие dropdown при
  // scroll/resize, потому что он позиционируется от button rect, который плывёт.
  useEffect(() => {
    if (!dropdownOpen && !ctxMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownOpen) {
        // Dropdown живёт в двух DOM-местах: триггер в своём вилке и панель
        // в portal'е под document.body. "Outside" значит «ни в том, ни в другом».
        const target = e.target as Node;
        const inTrigger = dropdownRef.current?.contains(target) ?? false;
        const inPanel = dropdownPanelRef.current?.contains(target) ?? false;
        if (!inTrigger && !inPanel) {
          setDropdownOpen(false);
        }
      }
      if (ctxMenu && ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    const closeDropdownOnLayoutChange = () => {
      if (dropdownOpen) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", closeDropdownOnLayoutChange);
    // capture: true — чтобы видеть scroll внутренних скролл-контейнеров,
    // а не только window.
    window.addEventListener("scroll", closeDropdownOnLayoutChange, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", closeDropdownOnLayoutChange);
      window.removeEventListener("scroll", closeDropdownOnLayoutChange, true);
    };
  }, [dropdownOpen, ctxMenu]);

  /**
   * Универсальный cleanup pending mouseLeave-таймера при ЛЮБОМ закрытии
   * dropdown'а (через клик пункта, click-outside, scroll/resize, программное
   * setDropdownOpen). Иначе stale timeout, запущенный mouseLeave, мог бы
   * сработать спустя 1500мс и закрыть только что переоткрытый dropdown.
   * Также чистит таймер на размонтировании компонента — защита от утечки.
   */
  useEffect(() => {
    if (!dropdownOpen && dropdownAutoCloseRef.current) {
      clearTimeout(dropdownAutoCloseRef.current);
      dropdownAutoCloseRef.current = null;
    }
    return () => {
      if (dropdownAutoCloseRef.current) {
        clearTimeout(dropdownAutoCloseRef.current);
        dropdownAutoCloseRef.current = null;
      }
    };
  }, [dropdownOpen]);

  // Escape закрывает шторки профиля и уведомлений.
  useEffect(() => {
    if (!profileOpen && !notifOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setProfileOpen(false); setNotifOpen(false); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [profileOpen, notifOpen]);

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setCtxMenu({ tabId, x: e.clientX, y: e.clientY });
  };

  /**
   * Меняем цвет таба. Если это реальный проектный таб — сохраняем на бэке
   * через workspace-shell context; локальный (custom/dup) — только в стейте.
   */
  const setTabColor = (tabId: string, color: string) => {
    setTabColors((prev) => ({ ...prev, [tabId]: color }));
    if (isRealProjectTab(tabId)) {
      void setProjectColor(tabId, color).catch(() => { /* откат в контексте */ });
    }
  };

  const isDark = theme === "dark";
  const hideSidebar = pathname.startsWith("/dashboards");

  return (
    <div className={`flex h-dvh text-foreground overflow-hidden ${isDark ? "bg-background" : "bg-[#f4f0eb]"}`}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && !hideSidebar && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      {!hideSidebar && <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : undefined }}
        className={`
          fixed inset-y-0 left-0 z-40 w-[220px] flex flex-col
          ${isDark ? "bg-surface/95" : "bg-white/80"} backdrop-blur-xl
          border-r ${isDark ? "border-border" : "border-border/40"}
          px-3 py-6
          lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 lg:z-10
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <BrandLogo onClose={() => setSidebarOpen(false)} />

        {/* Main nav */}
        <div className="mb-2 px-3">
          <p className="text-[11px] font-semibold text-muted/70 uppercase tracking-wider">{t.nav.main}</p>
        </div>
        <nav className="grid gap-0.5 px-1 mb-6" aria-label="Основная навигация">
          {mainNavKeys.map((item) => {
            const isActive =
              item.href === "/workspace" ? pathname === "/workspace" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                transitionTypes={["page-transition"]}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium no-underline overflow-hidden ${isActive
                  ? "text-accent-foreground"
                  : `${isDark ? "text-white/50 hover:text-white/80" : "text-muted hover:text-foreground"}`
                  }`}
                onClick={() => setSidebarOpen(false)}
              >
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 rounded-xl bg-accent shadow-sm shadow-accent/20"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {!isActive && (
                  <motion.span
                    className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${isDark ? "bg-white/[0.06]" : "bg-black/[0.04]"}`}
                  />
                )}
                <item.icon
                  size={18}
                  strokeWidth={1.8}
                  className={`relative z-10 transition-colors duration-200 ${isActive
                    ? "text-accent-foreground"
                    : `${isDark ? "text-white/40 group-hover:text-white/70" : "text-muted/70 group-hover:text-foreground"}`
                    }`}
                />
                <span className="relative z-10">{t.nav[item.key]}</span>
              </Link>
            );
          })}
        </nav>

        {/* Tools nav */}
        <div className="mb-2 px-3">
          <p className="text-[11px] font-semibold text-muted/70 uppercase tracking-wider">{t.nav.tools}</p>
        </div>
        <nav className="grid gap-0.5 px-1" aria-label="Инструменты">
          {toolNavKeys.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                transitionTypes={["page-transition"]}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium no-underline overflow-hidden ${isActive
                  ? "text-accent-foreground"
                  : `${isDark ? "text-white/50 hover:text-white/80" : "text-muted hover:text-foreground"}`
                  }`}
                onClick={() => setSidebarOpen(false)}
              >
                {isActive && (
                  <motion.span
                    layoutId="sidebar-tools-pill"
                    className="absolute inset-0 rounded-xl bg-accent shadow-sm shadow-accent/20"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {!isActive && (
                  <motion.span
                    className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${isDark ? "bg-white/[0.06]" : "bg-black/[0.04]"}`}
                  />
                )}
                <item.icon
                  size={18}
                  strokeWidth={1.8}
                  className={`relative z-10 transition-colors duration-200 ${isActive
                    ? "text-accent-foreground"
                    : `${isDark ? "text-white/40 group-hover:text-white/70" : "text-muted/70 group-hover:text-foreground"}`
                    }`}
                />
                <span className="relative z-10">{t.nav[item.key]}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom info — реальное число проектов в активном workspace
            (созданные + те, куда юзер приглашён). Раньше было захардкожено
            "6 online" — выглядело правдоподобно, но цифра была не настоящая.
            useWorkspaceShell отдаёт `projects` уже отфильтрованным по
            активному workspace, поэтому это именно «мои активные проекты». */}
        <div className="mt-auto px-2">
          <div className={`rounded-xl p-3 ${isDark ? "bg-white/[0.04]" : "bg-surface-secondary/60"}`}>
            <p className="m-0 text-[11px] font-medium text-muted">{t.common.projects}</p>
            <p className="m-0 mt-0.5 text-sm font-bold">{projects.length}</p>
          </div>
        </div>
      </motion.aside>}

      {/* Main content wrapper — scrolls internally, not body */}
      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto" ref={mainRef}>
        {/* Top header */}
        <header ref={headerRef} className={`sticky top-0 z-20 flex items-center gap-3 px-4 sm:px-6 lg:px-8 backdrop-blur-xl border-b transition-all duration-500 ease-out ${scrolled || profileOpen ? "py-2" : "py-4"} ${scrolled || profileOpen
          ? `${isDark ? "bg-surface/95 border-border" : "bg-white/80 border-border/40"}`
          : `${isDark ? "bg-background/0 border-transparent" : "bg-[#f4f0eb]/0 border-transparent"}`
          }`}>
          {/* Mobile menu btn */}
          {!hideSidebar && <Button
            isIconOnly
            variant="secondary"
            className="flex lg:hidden shrink-0"
            aria-label={t.shell.tabTooltipMore}
            onPress={() => setSidebarOpen(true)}
          >
            <Menu01Icon size={18} strokeWidth={1.8} />
          </Button>}

          {/* LEFT: Project tabs (browser-style, collapse on no hover) */}
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide shrink min-w-0">
            {/*
              Skeleton-табов во время cold start: 2 пустых rounded-плейсхолдера
              с pulse-анимацией. Подменяет реальные табы пока `loadEverything()`
              не завершился (бэк не вернул workspaces+projects). Размер
              согласован со scrolled-collapsed табом (h-7 w-9), чтобы не было
              layout-shift при подмене на реальные элементы.
            */}
            {isInitialLoading &&
              Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={`tab-skeleton-${i}`}
                  className={`shrink-0 rounded-lg animate-pulse ${scrolled ? "h-7 w-9" : "h-8 w-10"} ${isDark ? "bg-white/[0.05]" : "bg-black/[0.04]"}`}
                  aria-hidden="true"
                />
              ))}
            {!isInitialLoading && openTabs.map((tabId) => {
              const isActive = activeProjectId === tabId;
              const isEditing = editingTabId === tabId;
              const tabColor = tabColors[tabId];
              return (
                <div
                  key={tabId}
                  className={`group/tab flex items-center rounded-lg font-medium whitespace-nowrap transition-all duration-300 ease-out cursor-pointer overflow-hidden ${scrolled ? "py-1.5 text-xs" : "py-2 text-sm"} ${isEditing
                    ? `${scrolled ? "px-3 max-w-[200px]" : "px-4 max-w-[220px]"}`
                    : `${scrolled ? "px-2 max-w-[32px] hover:px-3 hover:max-w-[200px]" : "px-2.5 max-w-[36px] hover:px-4 hover:max-w-[220px]"}`
                    } ${isActive
                      ? `${isDark ? "bg-white/8 text-white/90" : "bg-black/[0.04] text-foreground"}`
                      : `${isDark ? "text-white/30 hover:bg-white/6 hover:text-white/70" : "text-muted/50 hover:bg-black/[0.03] hover:text-foreground"}`
                    }`}
                  onClick={() => {
                    setActiveProjectId(tabId);
                    router.push(`/projects/${tabId}`);
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    startRenaming(tabId);
                  }}
                  onContextMenu={(e) => handleTabContextMenu(e, tabId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={() => { }}
                  title={getTabName(tabId)}
                >
                  <Folder02Icon size={scrolled ? 13 : 15} strokeWidth={1.8} style={{ color: tabColor || getTabColor(tabId) || undefined }} className={`shrink-0 transition-colors duration-300 ${!tabColor && !getTabColor(tabId) ? (isActive ? (isDark ? "text-white/70" : "text-foreground/60") : (isDark ? "text-white/25 group-hover/tab:text-white/60" : "text-muted/40 group-hover/tab:text-foreground/60")) : ""}`} />
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditingTabId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={`ml-2 w-20 bg-transparent border-b outline-none text-inherit font-inherit ${isDark ? "border-white/20" : "border-foreground/20"}`}
                    />
                  ) : (
                    <span className="ml-2 transition-all duration-300 opacity-0 group-hover/tab:opacity-100 truncate">{getTabName(tabId)}</span>
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    className={`ml-2 rounded p-0.5 shrink-0 transition-all duration-300 w-0 opacity-0 group-hover/tab:w-4 group-hover/tab:opacity-100 ${isDark ? "hover:bg-white/10" : "hover:bg-black/10"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isRealProjectTab(tabId)) { unpinTab(tabId); } else { closeTab(tabId); }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        if (isRealProjectTab(tabId)) { unpinTab(tabId); } else { closeTab(tabId); }
                      }
                    }}
                  >
                    <Cancel01Icon size={10} strokeWidth={2} />
                  </span>
                </div>
              );
            })}

            {/* Add tab button + dropdown */}
            <div
              className="relative flex items-center shrink-0"
              ref={dropdownRef}
              onMouseEnter={() => {
                // Курсор над триггером — отменяем плановое автозакрытие
                // (например, пользователь вернулся из portal-panel назад на «▾»).
                if (dropdownAutoCloseRef.current) {
                  clearTimeout(dropdownAutoCloseRef.current);
                  dropdownAutoCloseRef.current = null;
                }
              }}
              onMouseLeave={() => {
                // Курсор ушёл с триггера. Если dropdown открыт, запускаем
                // таймер автозакрытия. Если пользователь перешёл на panel —
                // её onMouseEnter отменит таймер.
                if (!dropdownOpen) return;
                if (dropdownAutoCloseRef.current) {
                  clearTimeout(dropdownAutoCloseRef.current);
                }
                dropdownAutoCloseRef.current = setTimeout(() => {
                  setDropdownOpen(false);
                  dropdownAutoCloseRef.current = null;
                }, 1500);
              }}
            >
              <button
                type="button"
                title={t.shell.tabTooltipNew}
                aria-label={t.shell.tabTooltipNew}
                onClick={addTab}
                className={`flex items-center justify-center rounded-lg transition-all duration-300 ease-out ${scrolled ? "h-7 w-7" : "h-8 w-8"} ${isDark ? "text-white/30 hover:bg-white/[0.06] hover:text-white/60" : "text-muted/50 hover:bg-black/5 hover:text-foreground"}`}
              >
                <Add01Icon size={scrolled ? 13 : 15} strokeWidth={2} />
              </button>
              <button
                ref={dropdownTriggerRef}
                type="button"
                title={t.shell.tabTooltipMore}
                aria-label={t.shell.tabTooltipMore}
                onClick={() => {
                  // При открытии запоминаем реальные viewport-координаты
                  // wrapper'а (содержит обе кнопки «+» и «▾»). Берём именно wrapper,
                  // а не отдельную кнопку «▾» — так left edge сразу совпадает
                  // с левым краем «+» без ручного вычитания ширины.
                  if (!dropdownOpen) {
                    const wrapper = dropdownRef.current;
                    if (wrapper) {
                      const rect = wrapper.getBoundingClientRect();
                      setDropdownPos({ x: rect.left, y: rect.bottom + 6 });
                    }
                  }
                  setDropdownOpen((v) => !v);
                }}
                className={`flex items-center justify-center rounded-lg transition-all duration-300 ease-out ${scrolled ? "h-7 w-5" : "h-8 w-6"} -ml-1 ${isDark ? "text-white/30 hover:bg-white/[0.06] hover:text-white/60" : "text-muted/50 hover:bg-black/5 hover:text-foreground"}`}
              >
                <ArrowDown01Icon size={scrolled ? 11 : 13} strokeWidth={2} />
              </button>

              {/* Dropdown menu — рендерится через React Portal в document.body.
               *
               * ПРИЧИНА: вверх по дереву (motion.div / motion.aside) есть элементы
               * с активным CSS `transform` (framer-motion). По спецификации CSS
               * `position: fixed` внутри такого ancestor'а позиционируется
               * ОТНОСИТЕЛЬНО ЭТОГО ancestor'а, а не viewport — поэтому
               * `top/left` вызывают смещение. Portal выводит узел из этого
               * контекста в document.body, и fixed работает ожидаемо
               * относительно viewport.
               *
               * На SSR document не существует — поэтому проверяем typeof document.
               * Дивиденд живёт вне dropdownRef DOM-поддерева, поэтому click
               * внутри него срабатывает click-outside и закрывает menu. Поэтому
               * вешаем второй ref `dropdownPanelRef` на саму панель и расширяем
               * click-outside-проверку ниже. */}
              {dropdownOpen && dropdownPos && typeof document !== "undefined" && createPortal(
                <div
                  ref={dropdownPanelRef}
                  style={{ position: "fixed", left: dropdownPos.x, top: dropdownPos.y }}
                  className={`w-56 rounded-xl border p-1 shadow-lg z-[100] ${isDark ? "bg-surface border-border" : "bg-white border-border/50 shadow-black/8"}`}
                  onMouseEnter={() => {
                    // Курсор вернулся в panel — отменяем плановое автозакрытие.
                    if (dropdownAutoCloseRef.current) {
                      clearTimeout(dropdownAutoCloseRef.current);
                      dropdownAutoCloseRef.current = null;
                    }
                  }}
                  onMouseLeave={() => {
                    // Курсор ушёл — закрываем через короткую задержку, чтобы
                    // случайный «промах» курсора не сворачивал menu сразу.
                    if (dropdownAutoCloseRef.current) {
                      clearTimeout(dropdownAutoCloseRef.current);
                    }
                    dropdownAutoCloseRef.current = setTimeout(() => {
                      setDropdownOpen(false);
                      dropdownAutoCloseRef.current = null;
                    }, 1500);
                  }}
                >
                  <button type="button" onClick={() => { addTab(); setDropdownOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-white/70 hover:bg-white/6 hover:text-white" : "text-foreground/70 hover:bg-surface-secondary hover:text-foreground"}`}>
                    <Add01Icon size={14} strokeWidth={1.8} />
                    {t.projects.newProject}
                  </button>
                  <button type="button" onClick={() => { setPinDialogOpen(true); setDropdownOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-white/70 hover:bg-white/6 hover:text-white" : "text-foreground/70 hover:bg-surface-secondary hover:text-foreground"}`}>
                    <Folder02Icon size={14} strokeWidth={1.8} />
                    {t.shell.tabMenuPinExisting}
                  </button>
                  <button type="button" onClick={duplicateActiveTab} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-white/70 hover:bg-white/6 hover:text-white" : "text-foreground/70 hover:bg-surface-secondary hover:text-foreground"}`}>
                    <Copy01Icon size={14} strokeWidth={1.8} />
                    {t.shell.tabMenuDuplicate}
                  </button>
                  <button type="button" onClick={() => { if (activeProjectId) startRenaming(activeProjectId); setDropdownOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-white/70 hover:bg-white/6 hover:text-white" : "text-foreground/70 hover:bg-surface-secondary hover:text-foreground"}`}>
                    <PencilEdit01Icon size={14} strokeWidth={1.8} />
                    {t.shell.tabMenuRename}
                  </button>
                  <div className={`my-1 h-px ${isDark ? "bg-white/6" : "bg-border/50"}`} />
                  <button type="button" onClick={closeOtherTabs} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-white/70 hover:bg-white/6 hover:text-white" : "text-foreground/70 hover:bg-surface-secondary hover:text-foreground"}`}>
                    <Cancel01Icon size={14} strokeWidth={1.8} />
                    {t.shell.tabMenuCloseOther}
                  </button>
                  <button type="button" onClick={closeAllTabs} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-red-400/80 hover:bg-red-500/10 hover:text-red-400" : "text-red-500/70 hover:bg-red-50 hover:text-red-600"}`}>
                    <Cancel01Icon size={14} strokeWidth={1.8} />
                    {t.shell.tabMenuCloseAll}
                  </button>
                </div>,
                document.body,
              )}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* RIGHT: Search + actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Глобальный поиск по задачам/проектам с дропдауном и клик-навигацией.
                 Импорт `Search01Icon` сохраняем — он ещё используется в drawer
                 уведомлений ниже. */}
            <HeaderSearch isDark={isDark} scrolled={scrolled} projects={allProjects} />

            {/* Theme toggle - simple icon button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              className={`flex items-center justify-center rounded-lg transition-all duration-300 ease-out ${scrolled ? "h-8 w-8" : "h-9 w-9"} ${isDark ? "hover:bg-white/[0.06] text-white/50 hover:text-white/80" : "hover:bg-black/5 text-muted hover:text-foreground"}`}
            >
              {isDark ? <Sun01Icon size={scrolled ? 16 : 18} strokeWidth={1.8} /> : <Moon02Icon size={scrolled ? 16 : 18} strokeWidth={1.8} />}
            </button>

            {/* Language switcher */}
            <LocaleSwitcher />

            {/* Notifications */}
            <button
              type="button"
              onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }}
              className={`relative flex items-center justify-center rounded-lg transition-all duration-300 ease-out ${scrolled ? "h-8 w-8" : "h-9 w-9"} ${notifOpen ? (isDark ? "bg-white/8 text-white/90" : "bg-black/[0.05] text-foreground") : (isDark ? "hover:bg-white/[0.06] text-white/50 hover:text-white/80" : "hover:bg-black/5 text-muted hover:text-foreground")}`}
            >
              <Notification01Icon size={scrolled ? 16 : 18} strokeWidth={1.8} />
              <AnimatePresence>
                {unreadNotifCount > 0 && (
                  <motion.span
                    // key=count чтобы при изменении числа фреймер дёргал
                    // exit/enter и был мини-pop эффект.
                    key={unreadNotifCount > 99 ? "99plus" : String(unreadNotifCount)}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className={
                      unreadNotifCount > 9
                        ? "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground leading-none"
                        : "absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-accent-foreground leading-none"
                    }
                  >
                    {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {/* Profile */}
            <button
              type="button"
              onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}
              className={`flex items-center justify-center rounded-full bg-accent/10 hover:bg-accent/20 transition-all duration-300 ease-out ${scrolled ? "h-8 w-8" : "h-9 w-9"}`}
            >
              <UserCircleIcon size={scrolled ? 20 : 22} strokeWidth={1.5} className="text-accent" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      {/* Tab context menu */}
      {ctxMenu && (
        <div
          ref={ctxMenuRef}
          className={`fixed z-[100] w-52 rounded-xl border p-1.5 shadow-xl ${isDark ? "bg-surface border-border" : "bg-white border-border/50 shadow-black/10"}`}
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {/* Color palette */}
          <div className="px-2 pt-1 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <ColorsIcon size={13} strokeWidth={1.8} className="text-muted" />
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-muted"}`}>{t.shell.tabMenuColor}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {TAB_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => { setTabColor(ctxMenu.tabId, color); setCtxMenu(null); }}
                  className="h-5 w-5 rounded-full transition-transform hover:scale-125 ring-1 ring-black/10"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  // 1) Чистим локальный override.
                  setTabColors((prev) => {
                    const n = { ...prev };
                    delete n[ctxMenu.tabId];
                    return n;
                  });
                  // 2) Для РЕАЛЬНОГО проектного таба обязательно
                  //    сбрасываем цвет и на бэке: иконка таба
                  //    рендерится как `tabColors[id] || getTabColor(id)`,
                  //    где `getTabColor` тянет `project.color` из
                  //    workspace-shell context. Если оставить только
                  //    локальный delete, цвет «вернётся» сразу же из
                  //    persisted-проекта, и пользователь видит, что
                  //    «сброс не работает». Передаём пустую строку —
                  //    `setProjectColor` шлёт PATCH со значением "",
                  //    бэк хранит null/empty, рендер падает в дефолт.
                  if (isRealProjectTab(ctxMenu.tabId)) {
                    void setProjectColor(ctxMenu.tabId, "").catch(() => { /* откат в контексте */ });
                  }
                  setCtxMenu(null);
                }}
                className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ring-1 flex items-center justify-center text-[9px] ${isDark ? "ring-white/10 bg-white/6 text-white/40" : "ring-black/10 bg-black/5 text-muted"}`}
                title={t.shell.tabMenuColorReset}
              >
                <Cancel01Icon size={8} strokeWidth={2.5} />
              </button>
            </div>
          </div>
          <div className={`my-1 h-px ${isDark ? "bg-white/6" : "bg-border/50"}`} />
          <button type="button" onClick={() => { startRenaming(ctxMenu.tabId); setCtxMenu(null); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-white/70 hover:bg-white/6 hover:text-white" : "text-foreground/70 hover:bg-surface-secondary hover:text-foreground"}`}>
            <PencilEdit01Icon size={14} strokeWidth={1.8} />
            {t.shell.tabMenuRename}
          </button>
          <button type="button" onClick={() => { const seq = tabIdSeq + 1; setTabIdSeq(seq); const id = `dup-${seq}`; setTabNames((prev) => ({ ...prev, [id]: `${getTabName(ctxMenu.tabId)} (copy)` })); if (tabColors[ctxMenu.tabId]) setTabColors((prev) => ({ ...prev, [id]: tabColors[ctxMenu.tabId] })); setOpenTabs((prev) => [...prev, id]); setActiveProjectId(id); setCtxMenu(null); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-white/70 hover:bg-white/6 hover:text-white" : "text-foreground/70 hover:bg-surface-secondary hover:text-foreground"}`}>
            <Copy01Icon size={14} strokeWidth={1.8} />
            {t.shell.tabMenuDuplicate}
          </button>
          <div className={`my-1 h-px ${isDark ? "bg-white/6" : "bg-border/50"}`} />
          <button type="button" onClick={() => { if (isRealProjectTab(ctxMenu.tabId)) { unpinTab(ctxMenu.tabId); } else { closeTab(ctxMenu.tabId); } setCtxMenu(null); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-red-400/80 hover:bg-red-500/10 hover:text-red-400" : "text-red-500/70 hover:bg-red-50 hover:text-red-600"}`}>
            {isRealProjectTab(ctxMenu.tabId) ? <PinOffIcon size={14} strokeWidth={1.8} /> : <Cancel01Icon size={14} strokeWidth={1.8} />}
            {isRealProjectTab(ctxMenu.tabId) ? t.shell.tabMenuUnpin : t.shell.tabMenuClose}
          </button>
        </div>
      )}
      {/* Shared overlay for all sheets */}
      {(profileOpen || notifOpen) && (
        <div
          className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-[2px] animate-[vt-sheet-overlay_200ms_ease-out_both]"
          onClick={() => { setProfileOpen(false); setNotifOpen(false); }}
        />
      )}

      {/* Notifications sheet — only mounted when open */}
      <AnimatePresence>
        {notifOpen && (
          <NotificationsSheet
            open
            onClose={() => setNotifOpen(false)}
            isDark={isDark}
            refreshSignal={notifRefreshSignal}
          />
        )}
      </AnimatePresence>

      {/* Profile sheet — only mounted when open */}
      <AnimatePresence>
        {profileOpen && (
          <motion.div
            key="profile-sheet"
            ref={profileRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            className={`fixed top-0 right-0 z-[100] h-dvh w-80 flex flex-col rounded-l-2xl ${isDark ? "bg-surface border-l border-border" : "bg-white border-l border-border/40"} shadow-2xl`}
          >
            {/* Sheet header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-border" : "border-border/40"}`}>
              <span className="text-sm font-semibold">{t.shell.profileTitle}</span>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className={`flex items-center justify-center h-7 w-7 rounded-lg transition-colors ${isDark ? "hover:bg-white/6 text-white/50" : "hover:bg-black/5 text-muted"}`}
              >
                <Cancel01Icon size={14} strokeWidth={2} />
              </button>
            </div>

            {/* User info — реальные данные из useAuth().
             *
             * Раньше тут было захардкожено "Alexey Vasilev / alexey@julow.io"
             * и три фейковых карточки статистики, из-за чего после логина
             * пользователь видел чужое имя и думал, что сессия не сохраняется.
             * На самом деле токены лежат в httpOnly-куках и `/api/auth/me`
             * корректно возвращает юзера — UI просто не использовал данные. */}
            <div className="px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-accent/15 flex items-center justify-center">
                  <UserCircleIcon size={28} strokeWidth={1.5} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold m-0 truncate">
                    {user?.email?.split("@")[0] ?? "—"}
                  </p>
                  <p className={`text-xs m-0 mt-0.5 truncate ${isDark ? "text-white/40" : "text-muted"}`}>
                    {user?.email ?? ""}
                  </p>
                </div>
              </div>
              {/* Реальная (а не выдуманная) метрика — единственное, что мы
               *   можем посчитать без дополнительных запросов: число
               *   проектов в активном workspace. */}
              <div className="mt-4 flex gap-2">
                <div className={`flex-1 rounded-xl p-3 text-center ${isDark ? "bg-white/4" : "bg-surface-secondary/60"}`}>
                  <p className="text-lg font-bold m-0">{projects.length}</p>
                  <p className={`text-[10px] m-0 ${isDark ? "text-white/40" : "text-muted"}`}>{t.shell.statProjects}</p>
                </div>
                <div className={`flex-1 rounded-xl p-3 text-center ${isDark ? "bg-white/4" : "bg-surface-secondary/60"}`}>
                  <p className="text-lg font-bold m-0">{openTabs.length}</p>
                  <p className={`text-[10px] m-0 ${isDark ? "text-white/40" : "text-muted"}`}>{t.shell.statOpenTabs}</p>
                </div>
                <div className={`flex-1 rounded-xl p-3 text-center ${isDark ? "bg-white/4" : "bg-surface-secondary/60"}`}>
                  <p className="text-lg font-bold m-0">{unreadNotifCount}</p>
                  <p className={`text-[10px] m-0 ${isDark ? "text-white/40" : "text-muted"}`}>{t.shell.statUnread}</p>
                </div>
              </div>
            </div>

            <div className={`mx-5 h-px ${isDark ? "bg-white/6" : "bg-border/50"}`} />

            {/* Menu items.
             *
             * Раньше тут были 4 декоративные кнопки без действий. Теперь две
             * первые ведут на `/settings` (там реализованы Account и
             * Preferences/General секции), уведомления открывают шторку,
             * пункт «Activity Log» удалён — backend такого BC не имеет.
             */}
            <nav className="flex-1 px-3 py-3 grid gap-0.5 content-start">
              {[
                {
                  icon: UserCircleIcon,
                  label: t.shell.menuAccount,
                  sub: t.shell.menuAccountSub,
                  onClick: () => {
                    setProfileOpen(false);
                    // Deep-link на вкладку Account — settings-page читает ?tab= и
                    // сразу открывает нужную секцию (био + сессии).
                    router.push("/settings?tab=account");
                  },
                },
                {
                  icon: Settings01Icon,
                  label: t.shell.menuPreferences,
                  sub: t.shell.menuPreferencesSub,
                  onClick: () => {
                    setProfileOpen(false);
                    router.push("/settings?tab=general");
                  },
                },
                {
                  icon: Notification01Icon,
                  label: t.shell.menuNotifications,
                  sub: unreadNotifCount > 0
                    ? t.shell.menuNotificationsUnread.replace("{{count}}", String(unreadNotifCount))
                    : t.shell.menuNotificationsAllRead,
                  onClick: () => {
                    setProfileOpen(false);
                    setNotifOpen(true);
                  },
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${isDark ? "hover:bg-white/6" : "hover:bg-surface-secondary"}`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? "bg-white/6" : "bg-surface-secondary"}`}>
                    <item.icon size={16} strokeWidth={1.8} className={`${isDark ? "text-white/50" : "text-muted"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold m-0">{item.label}</p>
                    <p className={`text-[10px] m-0 mt-0.5 ${isDark ? "text-white/30" : "text-muted/70"}`}>{item.sub}</p>
                  </div>
                  <ArrowRight01Icon size={14} strokeWidth={1.8} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? "text-white/30" : "text-muted"}`} />
                </button>
              ))}
            </nav>

            {/* Bottom */}
            <div className={`px-3 py-3 border-t ${isDark ? "border-border" : "border-border/40"}`}>
              <button
                type="button"
                disabled={!isAuthenticated}
                onClick={() => {
                  setProfileOpen(false);
                  void logout();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? "text-red-400/80 hover:bg-red-500/10" : "text-red-500/70 hover:bg-red-50"}`}
              >
                <Logout01Icon size={16} strokeWidth={1.8} />
                {t.shell.signOut}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Диалог «Закрепить существующий проект».
       *
       * Открывается из dropdown табов. Источник списка — `allProjects`
       * (cross-workspace), фильтрация и группировка делается внутри
       * компонента. При выборе вызываем `pinProject`, который снимает
       * проект с unpinned-флага (с записью в localStorage) и делает
       * таб активным, переключая workspace при необходимости. */}
      <PinProjectDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        projects={allProjects}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        openTabIds={openTabs}
        onPin={pinProject}
      />
    </div>
  );
}
