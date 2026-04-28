"use client";

import { Button } from "@heroui/react";
import {
  Add01Icon,
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  BubbleChatIcon,
  ArrowRight01Icon,
  Calendar01Icon,
  Call02Icon,
  Cancel01Icon,
  Clock01Icon,
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
  Search01Icon,
  Settings01Icon,
  Sun01Icon,
  UserCircleIcon,
} from "hugeicons-react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { WorkspaceShellProvider, useWorkspaceShell } from "@/components/workspace-shell-context";
import { AuthProvider } from "@/components/auth/auth-context";
import { useI18n } from "@/i18n/context";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

type AppShellProps = {
  children: React.ReactNode;
};

const mainNavKeys = [
  { href: "/workspace", key: "dashboard" as const, icon: DashboardCircleIcon },
  { href: "/today", key: "today" as const, icon: Calendar01Icon },
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

/* ── Notifications mock data ── */
type NotifItem = {
  id: string;
  type: "mention" | "task" | "comment" | "deadline" | "system";
  title: string;
  body: string;
  detail: string;          // expanded body shown in detail view
  project?: string;
  taskName?: string;
  time: string;
  fullTime: string;
  read: boolean;
  avatar?: string;
  avatarColor?: string;
  actions?: { label: string; primary?: boolean }[];
};

const MOCK_NOTIFS: NotifItem[] = [
  {
    id: "n1", type: "mention", read: false,
    title: "Marina mentioned you",
    body: "In «Design new landing page» — @Alexey can you review the wireframes?",
    detail: "Hi @Alexey,\n\nI've finished the initial wireframe for the new landing page. The hero section has three variants — could you take a look and let me know which direction fits best?\n\nI've also added comments for the sections where I'm unsure about the copy. Your input would really help before we move to high-fidelity.\n\nThanks!",
    project: "Julow Web App", taskName: "Design new landing page",
    time: "2 min ago", fullTime: "Today, 22:44",
    avatar: "MS", avatarColor: "#8b5cf6",
    actions: [{ label: "Open task", primary: true }, { label: "Reply" }],
  },
  {
    id: "n2", type: "task", read: false,
    title: "Task assigned to you",
    body: "«Set up CI/CD pipeline» was assigned by Denis",
    detail: "Denis assigned you to «Set up CI/CD pipeline» in the Julow Web App project.\n\nPriority: High · Due: Apr 20\n\nThis task covers GitHub Actions workflow, Docker image builds, staging and production deployment gates, and Slack notifications on failure.\n\nEstimated effort: 5 story points.",
    project: "Julow Web App", taskName: "Set up CI/CD pipeline",
    time: "18 min ago", fullTime: "Today, 22:28",
    avatar: "DP", avatarColor: "#f97316",
    actions: [{ label: "Open task", primary: true }, { label: "Decline" }],
  },
  {
    id: "n3", type: "deadline", read: false,
    title: "Deadline today",
    body: "«Auth token refresh flow» is due today at 17:00",
    detail: "This task is due today at 17:00 and is currently In Progress.\n\nTask: Auth token refresh flow\nProject: API Gateway · Sprint 9\nAssignee: Alexey Vasilev\nStory points: 5\n\nPlease update the status or request an extension if more time is needed.",
    project: "API Gateway", taskName: "Auth token refresh flow",
    time: "1h ago", fullTime: "Today, 21:46",
    actions: [{ label: "Update status", primary: true }, { label: "Request extension" }],
  },
  {
    id: "n4", type: "comment", read: true,
    title: "New comment",
    body: "Pavel left a comment on «API Specification v3»",
    detail: "Pavel wrote:\n\n\u00abThe authentication section looks good. One thing \u2014 we should clarify the token expiry behaviour when the refresh token itself expires. Right now the spec says \u2018return 401\u2019 but doesn\u2019t specify if the client should re-authenticate automatically or show an error screen.\n\nAlso, the rate-limiting headers are not documented. Worth adding?\u00bb",
    project: "Engineering", taskName: "API Specification v3",
    time: "3h ago", fullTime: "Today, 20:00",
    avatar: "PM", avatarColor: "#22c55e",
    actions: [{ label: "Reply", primary: true }, { label: "Open doc" }],
  },
  {
    id: "n5", type: "task", read: true,
    title: "Task completed",
    body: "Olga marked «User authentication flow» as Done",
    detail: "Olga moved «User authentication flow» to Done.\n\nProject: Julow Web App · Sprint 14\nCompleted: Apr 14, 19:32\n\nThis task included JWT refresh logic, remember-me functionality, and session invalidation on all devices. All acceptance criteria were met and QA sign-off received.",
    project: "Julow Web App", taskName: "User authentication flow",
    time: "5h ago", fullTime: "Today, 18:00",
    avatar: "OI", avatarColor: "#06b6d4",
    actions: [{ label: "View task" }],
  },
  {
    id: "n6", type: "system", read: true,
    title: "Sprint 14 started",
    body: "Your team kicked off Sprint 14 with 48 tasks",
    detail: "Sprint 14 has officially started.\n\nDates: Apr 14 – Apr 28\nTotal tasks: 48 · Story points: 124\nTeam: Alexey, Marina, Denis, Olga, Pavel\n\nTop priorities this sprint: dashboard analytics, CI/CD pipeline, and mobile push notifications. Check the board for your assignments.",
    project: "Julow Web App",
    time: "1d ago", fullTime: "Yesterday, 09:00",
    actions: [{ label: "View sprint board", primary: true }],
  },
  {
    id: "n7", type: "comment", read: true,
    title: "Reply to your comment",
    body: "Marina replied: «Good point, let's add that to the backlog»",
    detail: "You wrote:\n«We should consider adding dark mode support before the public launch.»\n\nMarina replied:\n«Good point, let's add that to the backlog. I'll create a task and link it to the design system epic. Could also be a nice sprint 15 candidate.»",
    project: "Design System",
    time: "1d ago", fullTime: "Yesterday, 14:22",
    avatar: "MS", avatarColor: "#8b5cf6",
    actions: [{ label: "Continue thread", primary: true }],
  },
  {
    id: "n8", type: "system", read: true,
    title: "Weekly digest ready",
    body: "Your team performance report for Apr 7–13 is available",
    detail: "Your weekly digest for Apr 7–13 is ready.\n\n• Tasks completed: 22\n• Velocity: 58 points (↑12% vs last week)\n• Cycle time: 2.1 days\n• Top contributor: Marina (8 tasks)\n• Overdue: 3 tasks need attention\n\nOpen the Reports section to see the full breakdown and charts.",
    time: "2d ago", fullTime: "Apr 13, 09:00",
    actions: [{ label: "View report", primary: true }],
  },
];

const NOTIF_META: Record<NotifItem["type"], { bg: string; fg: string; label: string; badge: string }> = {
  mention: { bg: "bg-violet-500/12", fg: "text-violet-500", label: "@", badge: "Mention" },
  task: { bg: "bg-accent/10", fg: "text-accent", label: "✓", badge: "Task" },
  comment: { bg: "bg-emerald-500/10", fg: "text-emerald-500", label: "💬", badge: "Comment" },
  deadline: { bg: "bg-red-500/10", fg: "text-red-500", label: "!", badge: "Deadline" },
  system: { bg: "bg-surface-secondary", fg: "text-muted", label: "·", badge: "System" },
};

/* Shared spring config */
const SPRING = { type: "spring" as const, stiffness: 380, damping: 38 };

/** List ↔ detail slide: `custom` is +1 (forward) or -1 (back) from AnimatePresence */
const NOTIF_LIST_VARIANTS = {
  enter: (d: number) => ({ x: d > 0 ? 0 : "-100%" }),
  center: { x: "0%" },
  leave: (d: number) => ({ x: d > 0 ? "-100%" : 0 }),
};


function NotifAvatar({ notif, size = 9 }: { notif: NotifItem; size?: number }) {
  const meta = NOTIF_META[notif.type];
  const cls = `flex shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white`;
  const sz = `h-${size} w-${size}`;
  if (notif.avatar) {
    return (
      <div className={`${cls} ${sz}`} style={{ backgroundColor: notif.avatarColor }}>
        {notif.avatar}
      </div>
    );
  }
  return (
    <div className={`${cls} ${sz} ${meta.bg} ${meta.fg}`}>
      {notif.type === "deadline" && <span className="text-base leading-none">!</span>}
      {notif.type === "system" && <Notification01Icon size={size === 9 ? 15 : 20} strokeWidth={1.8} />}
      {notif.type !== "deadline" && notif.type !== "system" && <span>{meta.label}</span>}
    </div>
  );
}

function NotificationsSheet({
  onClose,
  isDark,
}: {
  open?: boolean;
  onClose: () => void;
  isDark: boolean;
}) {
  const [items, setItems] = useState<NotifItem[]>(MOCK_NOTIFS);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);   // +1 = forward to detail, -1 = back to list

  const unreadCount = items.filter((n) => !n.read).length;
  const visible = filter === "unread" ? items.filter((n) => !n.read) : items;
  const selected = items.find((n) => n.id === selectedId) ?? null;

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) => setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  const dismiss = (id: string) => setItems((prev) => prev.filter((n) => n.id !== id));

  const openDetail = (id: string) => {
    setDir(1);
    setSelectedId(id);
    markRead(id);
  };

  const closeDetail = () => {
    setDir(-1);
    setSelectedId(null);
  };

  const borderCls = isDark ? "border-border" : "border-border/40";
  const subText = isDark ? "text-white/40" : "text-muted";
  const hoverBg = isDark ? "hover:bg-white/[0.04]" : "hover:bg-surface-secondary/50";

  return (
    <motion.div
      key="notif-sheet"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 40 }}
      className={`fixed top-0 right-0 z-[100] h-dvh w-[380px] max-w-[100vw] overflow-hidden rounded-l-2xl ${isDark ? "bg-surface border-l border-border" : "bg-white border-l border-border/40"} shadow-2xl`}
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
                <span className="text-sm font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${isDark ? "text-white/50 hover:bg-white/6 hover:text-white/80" : "text-muted hover:bg-surface-secondary hover:text-foreground"}`}>
                    Mark all read
                  </button>
                )}
                <button type="button" onClick={onClose}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isDark ? "hover:bg-white/6 text-white/50" : "hover:bg-black/5 text-muted"}`}>
                  <Cancel01Icon size={14} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className={`flex shrink-0 items-center gap-1 px-4 py-2 border-b ${isDark ? "border-border/60" : "border-border/30"}`}>
              {(["all", "unread"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors capitalize ${filter === f ? "bg-accent/10 text-accent" : `${subText} ${hoverBg}`}`}>
                  {f}
                  {f === "unread" && unreadCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent">{unreadCount}</span>
                  )}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isDark ? "bg-white/4" : "bg-surface-secondary"}`}>
                    <Notification01Icon size={22} strokeWidth={1.5} className="text-muted" />
                  </div>
                  <p className={`text-sm font-medium ${subText}`}>
                    {filter === "unread" ? "No unread notifications" : "All caught up!"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]/30">
                  {visible.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => openDetail(notif.id)}
                      className={`group relative flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors ${hoverBg} ${!notif.read ? (isDark ? "bg-white/[0.02]" : "bg-accent/[0.02]") : ""}`}
                    >
                      {!notif.read && (
                        <span className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent" />
                      )}
                      <div className="mt-0.5"><NotifAvatar notif={notif} size={9} /></div>
                      <div className="min-w-0 flex-1">
                        <p className={`m-0 text-[13px] font-semibold leading-tight ${!notif.read ? "" : subText}`}>
                          {notif.title}
                        </p>
                        <p className={`m-0 mt-0.5 line-clamp-2 text-[12px] leading-relaxed ${isDark ? "text-white/35" : "text-muted/70"}`}>
                          {notif.body}
                        </p>
                        <p className={`m-0 mt-1 text-[11px] ${isDark ? "text-white/25" : "text-muted/50"}`}>
                          {notif.time}
                        </p>
                      </div>
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); dismiss(notif.id); }}
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 ${isDark ? "hover:bg-white/8 text-white/30" : "hover:bg-black/5 text-muted/50"}`}>
                        <Cancel01Icon size={11} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`shrink-0 border-t px-4 py-3 ${borderCls}`}>
              <button type="button"
                className={`w-full rounded-xl py-2.5 text-xs font-medium transition-colors ${isDark ? "bg-white/4 text-white/60 hover:bg-white/6 hover:text-white/80" : "bg-surface-secondary text-muted hover:bg-surface-secondary/80 hover:text-foreground"}`}>
                View all notifications
              </button>
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
              <button type="button" onClick={closeDetail}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${isDark ? "hover:bg-white/6 text-white/50" : "hover:bg-black/5 text-muted"}`}>
                <ArrowLeft01Icon size={16} strokeWidth={2} />
              </button>
              <span className={`text-[11px] font-semibold uppercase tracking-wider flex-1 ${subText}`}>
                {NOTIF_META[selected.type].badge}
              </span>
              <button type="button" onClick={() => { dismiss(selected.id); closeDetail(); }}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isDark ? "hover:bg-white/6 text-white/50 hover:text-white/70" : "hover:bg-black/5 text-muted hover:text-foreground"}`}>
                <Cancel01Icon size={13} strokeWidth={2} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-5 space-y-5">
                {/* Sender + meta */}
                <div className="flex items-start gap-3">
                  <NotifAvatar notif={selected} size={11} />
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-sm font-bold leading-tight">
                      {selected.avatar
                        ? selected.avatar === "MS" ? "Marina Sokolova"
                          : selected.avatar === "DP" ? "Denis Petrov"
                            : selected.avatar === "PM" ? "Pavel Morozov"
                              : selected.avatar === "OI" ? "Olga Ivanova"
                                : "Team member"
                        : "Julow"}
                    </p>
                    <p className={`m-0 mt-0.5 text-[11px] ${subText}`}>{selected.fullTime}</p>
                  </div>
                  {/* Unread badge */}
                  {!selected.read && (
                    <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">New</span>
                  )}
                </div>

                {/* Title */}
                <h2 className="m-0 text-base font-bold leading-snug">{selected.title}</h2>

                {/* Project / task context */}
                {(selected.project || selected.taskName) && (
                  <div className={`rounded-xl border px-3.5 py-3 space-y-1 ${isDark ? "border-border/60 bg-white/[0.02]" : "border-border/40 bg-surface-secondary/40"}`}>
                    {selected.project && (
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase tracking-wider font-semibold ${subText}`}>Project</span>
                        <span className="text-[12px] font-medium">{selected.project}</span>
                      </div>
                    )}
                    {selected.taskName && (
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase tracking-wider font-semibold ${subText}`}>Task</span>
                        <span className="text-[12px] font-medium truncate">{selected.taskName}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Full body — email-style paragraphs */}
                <div className={`text-sm leading-relaxed space-y-3 ${isDark ? "text-white/75" : "text-foreground/80"}`}>
                  {selected.detail.split("\n\n").map((para, i) => (
                    <p key={i} className="m-0">{para}</p>
                  ))}
                </div>

                {/* Actions */}
                {selected.actions && selected.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selected.actions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={closeDetail}
                        className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${action.primary
                          ? "bg-accent text-accent-foreground hover:opacity-90 active:scale-95"
                          : isDark
                            ? "bg-white/6 text-white/70 hover:bg-white/10 hover:text-white"
                            : "bg-surface-secondary text-foreground/70 hover:bg-surface-secondary/80 hover:text-foreground"
                          }`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Detail footer */}
            <div className={`shrink-0 border-t px-5 py-3.5 ${borderCls}`}>
              <button type="button" onClick={closeDetail}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium transition-colors ${isDark ? "bg-white/4 text-white/60 hover:bg-white/6 hover:text-white/80" : "bg-surface-secondary text-muted hover:bg-surface-secondary/80 hover:text-foreground"}`}>
                <ArrowLeft01Icon size={13} strokeWidth={2} />
                Back to notifications
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <AuthProvider>
      <WorkspaceShellProvider>
        <AppShellContent>{children}</AppShellContent>
      </WorkspaceShellProvider>
    </AuthProvider>
  );
}

function AppShellContent({ children }: AppShellProps) {
  const { projects, activeProjectId, setActiveProjectId } =
    useWorkspaceShell();
  const { t } = useI18n();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [tabNames, setTabNames] = useState<Record<string, string>>({});
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tabColors, setTabColors] = useState<Record<string, string>>({});
  const [ctxMenu, setCtxMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);
  const mainRef = useRef<HTMLDivElement>(null);

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

  /* Init theme from localStorage / system preference */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("julow_theme") as "light" | "dark" | null;
      if (stored === "dark" || stored === "light") {
        queueMicrotask(() => setTheme(stored));
        return;
      }
    } catch { }
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      queueMicrotask(() => setTheme("dark"));
    }
  }, []);

  /* Sync theme to DOM */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (projects.length === 0) return;
    queueMicrotask(() => {
      setOpenTabs((current) => {
        const next = projects.map((project) => project.id);
        const keptCustom = current.filter((id) => id.startsWith("custom-") || id.startsWith("dup-"));
        return [...next, ...keptCustom];
      });
      setTabNames((current) => ({
        ...current,
        ...Object.fromEntries(projects.map((project) => [project.id, project.name])),
      }));
    });
  }, [projects]);

  const closeTab = (projectId: string) => {
    setOpenTabs((prev) => prev.filter((id) => id !== projectId));
    if (activeProjectId === projectId) {
      const remaining = openTabs.filter((id) => id !== projectId);
      setActiveProjectId(remaining[0] ?? "");
    }
  };

  const [tabIdSeq, setTabIdSeq] = useState(0);

  const addTab = () => {
    const seq = tabIdSeq + 1;
    setTabIdSeq(seq);
    const id = `custom-${seq}`;
    const name = `Tab ${openTabs.length + 1}`;
    setTabNames((prev) => ({ ...prev, [id]: name }));
    setOpenTabs((prev) => [...prev, id]);
    setActiveProjectId(id);
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
      setTabNames((prev) => ({ ...prev, [editingTabId]: editingName.trim() }));
    }
    setEditingTabId(null);
  };

  const getTabName = (tabId: string) => {
    if (tabNames[tabId]) return tabNames[tabId];
    const project = projects.find((p) => p.id === tabId);
    if (project) return project.name;
    return "Tab";
  };

  const getTabColor = (tabId: string) => {
    const project = projects.find((p) => p.id === tabId);
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

  useEffect(() => {
    if (!dropdownOpen && !ctxMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (ctxMenu && ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen, ctxMenu]);

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

  const setTabColor = (tabId: string, color: string) => {
    setTabColors((prev) => ({ ...prev, [tabId]: color }));
  };

  const isDark = theme === "dark";

  return (
    <div className={`flex h-dvh text-foreground overflow-hidden ${isDark ? "bg-background" : "bg-[#f4f0eb]"}`}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
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
      <motion.aside
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
        {/* ── Brand — static logo + hover letter jiggle ──────────── */}
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
                {/* Animated background */}
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

        {/* Bottom team info */}
        <div className="mt-auto px-2">
          <div className={`rounded-xl p-3 ${isDark ? "bg-white/[0.04]" : "bg-surface-secondary/60"}`}>
            <p className="m-0 text-[11px] font-medium text-muted">Команда</p>
            <p className="m-0 mt-0.5 text-sm font-bold">6 онлайн</p>
          </div>
        </div>
      </motion.aside>

      {/* Main content wrapper — scrolls internally, not body */}
      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto" ref={mainRef}>
        {/* Top header */}
        <header className={`sticky top-0 z-20 flex items-center gap-3 px-4 sm:px-6 lg:px-8 backdrop-blur-xl border-b transition-all duration-500 ease-out ${scrolled || profileOpen ? "py-2" : "py-4"} ${scrolled || profileOpen
          ? `${isDark ? "bg-surface/95 border-border" : "bg-white/80 border-border/40"}`
          : `${isDark ? "bg-background/0 border-transparent" : "bg-[#f4f0eb]/0 border-transparent"}`
          }`}>
          {/* Mobile menu btn */}
          <Button
            isIconOnly
            variant="secondary"
            className="flex lg:hidden shrink-0"
            aria-label="Открыть меню"
            onPress={() => setSidebarOpen(true)}
          >
            <Menu01Icon size={18} strokeWidth={1.8} />
          </Button>

          {/* LEFT: Project tabs (browser-style, collapse on no hover) */}
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide shrink min-w-0">
            {openTabs.map((tabId) => {
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
                      closeTab(tabId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        closeTab(tabId);
                      }
                    }}
                  >
                    <Cancel01Icon size={10} strokeWidth={2} />
                  </span>
                </div>
              );
            })}

            {/* Add tab button + dropdown */}
            <div className="relative flex items-center shrink-0" ref={dropdownRef}>
              <button
                type="button"
                title="New tab"
                onClick={addTab}
                className={`flex items-center justify-center rounded-lg transition-all duration-300 ease-out ${scrolled ? "h-7 w-7" : "h-8 w-8"} ${isDark ? "text-white/30 hover:bg-white/[0.06] hover:text-white/60" : "text-muted/50 hover:bg-black/5 hover:text-foreground"}`}
              >
                <Add01Icon size={scrolled ? 13 : 15} strokeWidth={2} />
              </button>
              <button
                type="button"
                title="More options"
                onClick={() => setDropdownOpen((v) => !v)}
                className={`flex items-center justify-center rounded-lg transition-all duration-300 ease-out ${scrolled ? "h-7 w-5" : "h-8 w-6"} -ml-1 ${isDark ? "text-white/30 hover:bg-white/[0.06] hover:text-white/60" : "text-muted/50 hover:bg-black/5 hover:text-foreground"}`}
              >
                <ArrowDown01Icon size={scrolled ? 11 : 13} strokeWidth={2} />
              </button>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <div className={`absolute top-full left-0 mt-1.5 w-48 rounded-xl border p-1 shadow-lg z-50 ${isDark ? "bg-surface border-border" : "bg-white border-border/50 shadow-black/8"}`}>
                  <button type="button" onClick={() => { addTab(); setDropdownOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-white/70 hover:bg-white/6 hover:text-white" : "text-foreground/70 hover:bg-surface-secondary hover:text-foreground"}`}>
                    <Add01Icon size={14} strokeWidth={1.8} />
                    New tab
                  </button>
                  <button type="button" onClick={duplicateActiveTab} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-white/70 hover:bg-white/6 hover:text-white" : "text-foreground/70 hover:bg-surface-secondary hover:text-foreground"}`}>
                    <Copy01Icon size={14} strokeWidth={1.8} />
                    Duplicate tab
                  </button>
                  <button type="button" onClick={() => { if (activeProjectId) startRenaming(activeProjectId); setDropdownOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-white/70 hover:bg-white/6 hover:text-white" : "text-foreground/70 hover:bg-surface-secondary hover:text-foreground"}`}>
                    <PencilEdit01Icon size={14} strokeWidth={1.8} />
                    Rename tab
                  </button>
                  <div className={`my-1 h-px ${isDark ? "bg-white/6" : "bg-border/50"}`} />
                  <button type="button" onClick={closeOtherTabs} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-white/70 hover:bg-white/6 hover:text-white" : "text-foreground/70 hover:bg-surface-secondary hover:text-foreground"}`}>
                    <Cancel01Icon size={14} strokeWidth={1.8} />
                    Close other tabs
                  </button>
                  <button type="button" onClick={closeAllTabs} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-red-400/80 hover:bg-red-500/10 hover:text-red-400" : "text-red-500/70 hover:bg-red-50 hover:text-red-600"}`}>
                    <Cancel01Icon size={14} strokeWidth={1.8} />
                    Close all tabs
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* RIGHT: Search + actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search */}
            <div className="group/search relative hidden sm:block">
              <Search01Icon
                size={scrolled ? 14 : 15}
                strokeWidth={2}
                className={`absolute left-3 top-1/2 -translate-y-1/2 transition-all duration-300 ease-out ${isDark ? "text-white/25 group-focus-within/search:text-accent" : "text-muted/40 group-focus-within/search:text-accent"}`}
              />
              <input
                type="text"
                placeholder="Search..."
                className={`w-36 lg:w-44 focus:w-52 lg:focus:w-64 rounded-xl border text-xs transition-all duration-300 ease-out focus:outline-none ${scrolled ? "py-1.5 pl-8 pr-10" : "py-2 pl-9 pr-10"} ${isDark
                  ? "border-white/8 bg-transparent text-white placeholder:text-white/25 focus:border-accent/40 focus:bg-white/6"
                  : "border-black/6 bg-transparent text-foreground placeholder:text-muted/40 focus:border-accent/40 focus:bg-black/3"
                  }`}
              />
              <kbd className={`absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border px-1.5 py-0.5 text-[9px] font-medium transition-opacity duration-200 group-focus-within/search:opacity-0 ${isDark ? "border-white/8 bg-white/4 text-white/30" : "border-black/[0.06] bg-black/[0.02] text-muted/50"
                }`}>
                ⌘F
              </kbd>
            </div>

            {/* Theme toggle - simple icon button */}
            <button
              type="button"
              onClick={() => {
                const next = isDark ? "light" : "dark";
                setTheme(next);
                try { localStorage.setItem("julow_theme", next); } catch { }
              }}
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
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent" />
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
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-muted"}`}>Tab color</span>
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
                onClick={() => { setTabColors((prev) => { const n = { ...prev }; delete n[ctxMenu.tabId]; return n; }); setCtxMenu(null); }}
                className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ring-1 flex items-center justify-center text-[9px] ${isDark ? "ring-white/10 bg-white/6 text-white/40" : "ring-black/10 bg-black/5 text-muted"}`}
                title="Remove color"
              >
                <Cancel01Icon size={8} strokeWidth={2.5} />
              </button>
            </div>
          </div>
          <div className={`my-1 h-px ${isDark ? "bg-white/6" : "bg-border/50"}`} />
          <button type="button" onClick={() => { startRenaming(ctxMenu.tabId); setCtxMenu(null); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-white/70 hover:bg-white/6 hover:text-white" : "text-foreground/70 hover:bg-surface-secondary hover:text-foreground"}`}>
            <PencilEdit01Icon size={14} strokeWidth={1.8} />
            Rename
          </button>
          <button type="button" onClick={() => { const seq = tabIdSeq + 1; setTabIdSeq(seq); const id = `dup-${seq}`; setTabNames((prev) => ({ ...prev, [id]: `${getTabName(ctxMenu.tabId)} (copy)` })); if (tabColors[ctxMenu.tabId]) setTabColors((prev) => ({ ...prev, [id]: tabColors[ctxMenu.tabId] })); setOpenTabs((prev) => [...prev, id]); setActiveProjectId(id); setCtxMenu(null); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-white/70 hover:bg-white/6 hover:text-white" : "text-foreground/70 hover:bg-surface-secondary hover:text-foreground"}`}>
            <Copy01Icon size={14} strokeWidth={1.8} />
            Duplicate
          </button>
          <div className={`my-1 h-px ${isDark ? "bg-white/6" : "bg-border/50"}`} />
          <button type="button" onClick={() => { closeTab(ctxMenu.tabId); setCtxMenu(null); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isDark ? "text-red-400/80 hover:bg-red-500/10 hover:text-red-400" : "text-red-500/70 hover:bg-red-50 hover:text-red-600"}`}>
            <Cancel01Icon size={14} strokeWidth={1.8} />
            Close tab
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
          <NotificationsSheet open onClose={() => setNotifOpen(false)} isDark={isDark} />
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
              <span className="text-sm font-semibold">Profile</span>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className={`flex items-center justify-center h-7 w-7 rounded-lg transition-colors ${isDark ? "hover:bg-white/6 text-white/50" : "hover:bg-black/5 text-muted"}`}
              >
                <Cancel01Icon size={14} strokeWidth={2} />
              </button>
            </div>

            {/* User info */}
            <div className="px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-accent/15 flex items-center justify-center">
                  <UserCircleIcon size={28} strokeWidth={1.5} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold m-0">Alexey Vasilev</p>
                  <p className={`text-xs m-0 mt-0.5 ${isDark ? "text-white/40" : "text-muted"}`}>alexey@julow.io</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <div className={`flex-1 rounded-xl p-3 text-center ${isDark ? "bg-white/4" : "bg-surface-secondary/60"}`}>
                  <p className="text-lg font-bold m-0">142</p>
                  <p className={`text-[10px] m-0 ${isDark ? "text-white/40" : "text-muted"}`}>Tasks</p>
                </div>
                <div className={`flex-1 rounded-xl p-3 text-center ${isDark ? "bg-white/4" : "bg-surface-secondary/60"}`}>
                  <p className="text-lg font-bold m-0">28</p>
                  <p className={`text-[10px] m-0 ${isDark ? "text-white/40" : "text-muted"}`}>Projects</p>
                </div>
                <div className={`flex-1 rounded-xl p-3 text-center ${isDark ? "bg-white/4" : "bg-surface-secondary/60"}`}>
                  <p className="text-lg font-bold m-0">96%</p>
                  <p className={`text-[10px] m-0 ${isDark ? "text-white/40" : "text-muted"}`}>Score</p>
                </div>
              </div>
            </div>

            <div className={`mx-5 h-px ${isDark ? "bg-white/6" : "bg-border/50"}`} />

            {/* Menu items */}
            <nav className="flex-1 px-3 py-3 grid gap-0.5 content-start">
              {[
                { icon: UserCircleIcon, label: "My Account", sub: "Manage your profile" },
                { icon: Settings01Icon, label: "Preferences", sub: "Theme, language, notifications" },
                { icon: Notification01Icon, label: "Notifications", sub: "3 unread" },
                { icon: Clock01Icon, label: "Activity Log", sub: "Recent actions" },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
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
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${isDark ? "text-red-400/80 hover:bg-red-500/10" : "text-red-500/70 hover:bg-red-50"}`}
              >
                <Logout01Icon size={16} strokeWidth={1.8} />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
