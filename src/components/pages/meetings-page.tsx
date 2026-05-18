"use client";

import {
  Badge,
  Button,
  Calendar,
  Card,
  DatePicker,
  Input,
  Label,
  Text,
  TimeField,
} from "@heroui/react";
import { CalendarDate, Time, getLocalTimeZone, today } from "@internationalized/date";
import { ArrowDown01Icon, Calendar01Icon, Call02Icon, Cancel01Icon } from "hugeicons-react";
import {
  Ellipsis,
  Maximize2,
  MessageSquare,
  Mic,
  Minimize2,
  MonitorUp,
  PhoneOff,
  Send,
  Users,
  Video,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/context";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import { api, type MeetingPayload } from "@/lib/api";

const PARTICIPANTS = [
  { initials: "AK", name: "Alexey", color: "#3b82f6" },
  { initials: "MV", name: "Marina", color: "#8b5cf6" },
  { initials: "DP", name: "Denis", color: "#f97316" },
  { initials: "OS", name: "Olga", color: "#06b6d4" },
  { initials: "PN", name: "Pavel", color: "#22c55e" },
];

const CHAT_PANEL_PX = 320;
/** Нижняя граница ширины колонки с карточкой встречи при открытом чате (иначе grid + layout-motion визуально «плющат» превью). */
const STAGE_COL_MIN_PX = 440;
const GRID_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Короче, чтобы меньше «мигания» страницы при открытии панели. */
const GRID_COL_TRANSITION = `grid-template-columns 0.18s ${GRID_EASE}`;

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function ParticipantTiles() {
  return (
    <div className="relative grid h-full min-h-[220px] grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 lg:min-h-[260px]">
      {PARTICIPANTS.map((p, i) => (
        <motion.div
          key={p.initials}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.06 + i * 0.04, type: "spring", stiffness: 400, damping: 30 }}
          className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]/90 p-2 shadow-sm sm:rounded-2xl sm:p-3"
        >
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-xs font-bold text-white shadow-md sm:h-14 sm:w-14 sm:text-sm"
            style={{ backgroundColor: p.color }}
          >
            {p.initials}
          </span>
          <span className="mt-1.5 truncate text-center text-[10px] font-medium text-[var(--foreground)] sm:mt-2 sm:text-xs">
            {p.name}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function AccordionBlock({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = useId();
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] ring-1 ring-[var(--border)]/30">
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={open}
        aria-controls={`${panelId}-panel`}
        onClick={onToggle}
        className="flex min-h-[44px] w-full shrink-0 cursor-pointer items-center justify-between gap-2 border-b border-[var(--border)]/50 bg-[var(--surface-secondary)]/40 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-secondary)]/55"
      >
        <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {title}
        </span>
        <ArrowDown01Icon
          size={16}
          className={`shrink-0 text-[var(--muted)] transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      <div
        id={`${panelId}-panel`}
        role="region"
        aria-labelledby={`${panelId}-trigger`}
        className="grid min-h-0 transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

type MeetingChatRow = { id: string; from: "peer" | "self"; text: string };

function ChatPanel({
  m,
  onClose,
  cancelLabel,
  sendLabel,
  inputPlaceholder,
}: {
  m: ReturnType<typeof useI18n>["t"]["meetings"];
  onClose: () => void;
  cancelLabel: string;
  sendLabel: string;
  inputPlaceholder: string;
}) {
  const [draft, setDraft] = useState("");
  const [rows, setRows] = useState<MeetingChatRow[]>(() => [
    { id: "seed-a", from: "peer", text: m.chatMock1 },
    { id: "seed-b", from: "self", text: m.chatMock2 },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollThreadToBottom = useCallback(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "end" });
  }, []);

  const sendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setRows((prev) => [...prev, { id: `local-${Date.now()}`, from: "self", text }]);
    setDraft("");
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollThreadToBottom);
      });
    });
  }, [draft, scrollThreadToBottom]);

  return (
    <div className="flex h-full min-h-0 min-w-[min(100%,var(--chat-w))] flex-col overflow-hidden rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)] shadow-lg [--chat-w:320px]">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)]/60 px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
          MV
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-semibold">{m.chatTitle}</p>
          <p className="m-0 truncate text-xs text-[var(--muted)]">{m.room1Title}</p>
        </div>
        <Button isIconOnly size="sm" variant="secondary" aria-label={cancelLabel} onPress={onClose}>
          <Cancel01Icon size={18} />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const isSelf = row.from === "self";
            const rowClass = `flex gap-2 ${isSelf ? "flex-row-reverse" : ""}`;
            const bubble = (
              <>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                    isSelf ? "bg-accent text-[var(--accent-foreground)]" : "bg-[#8b5cf6]"
                  }`}
                >
                  {isSelf ? "A" : "M"}
                </span>
                <div
                  className={`max-w-[min(100%,420px)] min-w-0 rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    isSelf
                      ? "rounded-tr-md bg-accent text-[var(--accent-foreground)]"
                      : "rounded-tl-md bg-[var(--surface-secondary)] text-[var(--foreground)]"
                  }`}
                >
                  <p className="m-0 whitespace-pre-wrap break-words">{row.text}</p>
                </div>
              </>
            );
            if (row.id.startsWith("local-")) {
              return (
                <motion.div
                  key={row.id}
                  layout
                  className={rowClass}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                >
                  {bubble}
                </motion.div>
              );
            }
            return (
              <div key={row.id} className={rowClass}>
                {bubble}
              </div>
            );
          })}
        </div>
        <div ref={endRef} className="h-px w-full shrink-0" aria-hidden />
      </div>
      <div className="shrink-0 border-t border-[var(--border)]/60 p-3">
        <form
          className="flex min-w-0 items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <motion.div layout transition={{ type: "spring", stiffness: 440, damping: 34 }} className="min-w-0 flex-1">
            <Input
              fullWidth
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={inputPlaceholder}
              aria-label={inputPlaceholder}
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
          </motion.div>
          <AnimatePresence mode="popLayout">
            {draft.trim() !== "" && (
              <motion.div
                key="meet-send"
                initial={{ scale: 0.35, opacity: 0, x: 28, filter: "blur(4px)" }}
                animate={{ scale: 1, opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ scale: 0.35, opacity: 0, x: 24, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 460, damping: 28 }}
                className="flex shrink-0"
              >
                <Button
                  type="submit"
                  isIconOnly
                  variant="primary"
                  size="md"
                  className="h-10 w-10 shrink-0 rounded-full shadow-sm"
                  aria-label={sendLabel}
                >
                  <Send className="size-[19px]" strokeWidth={2.25} aria-hidden />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </div>
  );
}

function ControlDock({
  m,
  onChat,
  onPeople,
  chatActive,
  peopleActive,
}: {
  m: ReturnType<typeof useI18n>["t"]["meetings"];
  onChat: () => void;
  onPeople: () => void;
  chatActive: boolean;
  peopleActive: boolean;
}) {
  const idle =
    "border-0 bg-[var(--surface-secondary)]/90 text-[var(--foreground)] shadow-none hover:bg-[var(--surface-tertiary)]";
  const on =
    "border-0 bg-accent/20 text-accent shadow-none ring-1 ring-inset ring-accent/40 hover:bg-accent/28";

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [shareOn, setShareOn] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const dockRef = useRef<HTMLDivElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hint, setHint] = useState<{ title: string; description: string } | null>(null);
  const [hintVisible, setHintVisible] = useState(false);

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const hideHint = useCallback(() => {
    clearShowTimer();
    clearHideTimer();
    setHintVisible(false);
    hideTimerRef.current = setTimeout(() => {
      setHint(null);
      hideTimerRef.current = null;
    }, 90);
  }, [clearHideTimer, clearShowTimer]);

  const scheduleHint = useCallback(
    (title: string, description: string) => {
      clearShowTimer();
      clearHideTimer();
      setHintVisible(false);
      setHint(null);
      showTimerRef.current = setTimeout(() => {
        setHint({ title, description });
        requestAnimationFrame(() => setHintVisible(true));
        showTimerRef.current = null;
      }, 1000);
    },
    [clearHideTimer, clearShowTimer],
  );

  const onDockPointerLeave = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const next = e.relatedTarget;
      if (next instanceof Node && dockRef.current?.contains(next)) return;
      hideHint();
    },
    [hideHint],
  );

  const items = [
    { Icon: Mic, label: m.mute, hint: m.hintMute, active: micOn, onPress: () => setMicOn((v) => !v) },
    { Icon: Video, label: m.video, hint: m.hintCamera, active: camOn, onPress: () => setCamOn((v) => !v) },
    { Icon: MonitorUp, label: m.share, hint: m.hintShare, active: shareOn, onPress: () => setShareOn((v) => !v) },
    {
      Icon: MessageSquare,
      label: m.chat,
      hint: m.hintChat,
      active: chatActive,
      onPress: onChat,
    },
    { Icon: Users, label: m.people, hint: m.hintPeople, active: peopleActive, onPress: onPeople },
    { Icon: Ellipsis, label: m.more, hint: m.hintMore, active: moreOpen, onPress: () => setMoreOpen((v) => !v) },
  ] as const;

  return (
    <div
      ref={dockRef}
      onPointerLeave={onDockPointerLeave}
      className="pointer-events-auto relative flex flex-wrap items-center justify-center gap-0.5 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)]/95 px-1.5 py-1.5 shadow-lg backdrop-blur-xl"
    >
      {hint ? (
        <div
          role="tooltip"
          className={`absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-[min(calc(100vw-32px),280px)] max-w-[min(calc(100vw-32px),280px)] -translate-x-1/2 rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] px-[14px] py-2.5 text-left shadow-lg transition-opacity motion-reduce:transition-none ${
            hintVisible
              ? "pointer-events-auto opacity-100 duration-200 ease-out"
              : "pointer-events-none opacity-0 duration-75 ease-linear"
          }`}
        >
          <span className="block text-xs font-semibold leading-tight text-[var(--foreground)]">{hint.title}</span>
          <span className="mt-1 block text-[11px] leading-snug text-[var(--muted)]">{hint.description}</span>
        </div>
      ) : null}
      {items.map(({ Icon, label, hint: hintText, active, onPress }) => (
        <Button
          key={label}
          isIconOnly
          size="sm"
          variant="secondary"
          aria-label={label}
          aria-pressed={active}
          onPress={onPress}
          onPointerEnter={() => scheduleHint(label, hintText)}
          onPointerLeave={clearShowTimer}
          className={active ? on : idle}
        >
          <Icon className="size-[17px]" strokeWidth={2} />
        </Button>
      ))}
      <Button
        isIconOnly
        size="sm"
        variant="primary"
        aria-label={m.leave}
        onPointerEnter={() => scheduleHint(m.leave, m.hintLeave)}
        onPointerLeave={clearShowTimer}
        className="ml-0.5 bg-red-500 text-white hover:bg-red-600"
      >
        <PhoneOff className="size-[17px]" strokeWidth={2} />
      </Button>
    </div>
  );
}

function PeoplePanel({
  m,
  onClose,
  cancelLabel,
}: {
  m: ReturnType<typeof useI18n>["t"]["meetings"];
  onClose: () => void;
  cancelLabel: string;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-[min(100%,var(--chat-w))] flex-col overflow-hidden rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)] shadow-lg [--chat-w:320px]">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)]/60 px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15">
          <Users className="size-5 text-accent" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-semibold">{m.peopleSheetTitle}</p>
          <p className="m-0 truncate text-xs text-[var(--muted)]">{m.peopleSheetSubtitle}</p>
        </div>
        <Button isIconOnly size="sm" variant="secondary" aria-label={cancelLabel} onPress={onClose}>
          <Cancel01Icon size={18} />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3">
        {PARTICIPANTS.map((p) => (
          <div
            key={p.initials}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)]/50 bg-[var(--surface-secondary)]/40 px-3 py-2"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: p.color }}
            >
              {p.initials}
            </span>
            <span className="min-w-0 truncate text-sm font-medium text-[var(--foreground)]">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MeetingsPage() {
  const { t, locale } = useI18n();
  const m = t.meetings;
  const c = t.chats;
  const { activeWorkspaceId } = useWorkspaceShell();
  type SidePanel = "chat" | "people" | null;
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const sideOpen = sidePanel !== null;
  const [stageExpanded, setStageExpanded] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDateVal, setScheduleDateVal] = useState<CalendarDate | null>(null);
  const [scheduleTimeVal, setScheduleTimeVal] = useState<Time | null>(null);
  const isLg = useMediaQuery("(min-width: 1024px)");
  const timeZone = getLocalTimeZone();

  // ── Real meetings state ──────────────────────────────────────
  const [meetings, setMeetings] = useState<MeetingPayload[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.listMyMeetings().then((list) => {
      if (cancelled) return;
      setMeetings(list);
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [refreshKey]);

  /**
   * Делим митинги на upcoming/history по статусу. Завершённые/отменённые → история,
   * остальные (`scheduled`, `in_progress`) → предстоящие. Дополнительная фильтрация
   * по времени делалась бы здесь, но `Date.now()` в render считается impure.
   */
  const upcomingMeetings = useMemo(() => {
    return meetings
      .filter((mt) => {
        const status = mt.status?.toLowerCase() ?? "";
        return status !== "completed" && status !== "cancelled";
      })
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  }, [meetings]);

  const historyMeetings = useMemo(() => {
    return meetings
      .filter((mt) => {
        const status = mt.status?.toLowerCase() ?? "";
        return status === "completed" || status === "cancelled";
      })
      .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""));
  }, [meetings]);

  const formatMeetingTime = useCallback((iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const tag = locale === "ru" ? "ru-RU" : locale === "de" ? "de-DE" : "en-US";
    return d.toLocaleString(tag, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }, [locale]);

  const handleJoinMeeting = useCallback(async (meetingId: string) => {
    try {
      const join = await api.joinMeeting(meetingId);
      if (join.joinUrl) window.open(join.joinUrl, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }
  }, []);

  const handleCreateInstantRoom = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const title = newRoomName.trim() || m.newRoom;
    try {
      const meeting = await api.createMeeting({
        workspaceId: activeWorkspaceId,
        title,
        meetingType: "instant",
      });
      setNewRoomName("");
      setNewRoomOpen(false);
      setRefreshKey((k) => k + 1);
      // сразу открываем комнату, если бэкенд вернул join_url
      void handleJoinMeeting(meeting.id);
    } catch {
      // ignore
    }
  }, [activeWorkspaceId, newRoomName, m.newRoom, handleJoinMeeting]);

  const handleScheduleMeeting = useCallback(async () => {
    if (!activeWorkspaceId || !scheduleDateVal) return;
    const title = scheduleTitle.trim() || m.scheduleMeeting;
    const time = scheduleTimeVal ?? new Time(9, 0);
    // CalendarDate + Time → ISO в локальной TZ
    const dt = new Date(
      scheduleDateVal.year,
      scheduleDateVal.month - 1,
      scheduleDateVal.day,
      time.hour,
      time.minute,
    );
    try {
      await api.createMeeting({
        workspaceId: activeWorkspaceId,
        title,
        meetingType: "scheduled",
        scheduledAt: dt.toISOString(),
        durationMinutes: 30,
      });
      setScheduleTitle("");
      setScheduleDateVal(null);
      setScheduleTimeVal(null);
      setScheduleOpen(false);
      setRefreshKey((k) => k + 1);
    } catch {
      // ignore
    }
  }, [activeWorkspaceId, scheduleDateVal, scheduleTimeVal, scheduleTitle, m.scheduleMeeting]);

  const openChat = useCallback(() => {
    setSidePanel((p) => (p === "chat" ? null : "chat"));
  }, []);

  const openPeople = useCallback(() => {
    setSidePanel((p) => (p === "people" ? null : "people"));
  }, []);

  const closeSidePanel = useCallback(() => setSidePanel(null), []);

  useEffect(() => {
    if (!sideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidePanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sideOpen]);

  const stageShell = `relative min-h-0 flex-1 overflow-hidden bg-gradient-to-b from-[var(--surface-tertiary)]/95 via-[var(--surface-secondary)] to-[var(--background)] ${
    stageExpanded ? "rounded-t-2xl" : "rounded-2xl"
  }`;

  const stageInner = (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_18%,color-mix(in_oklab,var(--accent)_12%,transparent),transparent_58%)]" />
      <ParticipantTiles />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--background)]/90 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center px-2 pb-3 pt-6 sm:px-3 sm:pb-4">
        <ControlDock
          m={m}
          onChat={openChat}
          onPeople={openPeople}
          chatActive={sidePanel === "chat"}
          peopleActive={sidePanel === "people"}
        />
      </div>
    </>
  );

  const stageCard = (
    <Card
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring-1 ring-[var(--border)]/50 ${stageExpanded ? "min-h-0" : ""}`}
    >
      <Card.Header className="flex w-full min-w-0 shrink-0 flex-col items-stretch gap-0 overflow-visible border-b border-[var(--border)]/60 px-3 py-2.5 text-left sm:px-4 sm:py-3">
        <div className="flex w-full min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-left">
            <Card.Title className="text-left text-sm font-semibold">{m.stageLabel}</Card.Title>
            <Text color="muted" className="m-0 mt-0.5 text-left text-xs">
              {m.stageHint}
            </Text>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0"
            onPress={() => setStageExpanded((v) => !v)}
            aria-label={stageExpanded ? m.collapseRoom : m.expandRoom}
          >
            {stageExpanded ? (
              <Minimize2 className="size-4" strokeWidth={2} />
            ) : (
              <Maximize2 className="size-4" strokeWidth={2} />
            )}
            <span className="hidden sm:inline">{stageExpanded ? m.collapseRoom : m.expandRoom}</span>
          </Button>
        </div>
        <motion.div
          layout="position"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 32, delay: 0.04 }}
          className="relative z-20 mt-3 w-full"
        >
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-accent/30 bg-gradient-to-r from-accent/18 via-accent/10 to-transparent px-3 py-1.5 text-xs font-semibold leading-none text-accent shadow-[0_1px_0_color-mix(in_oklab,var(--accent)_25%,transparent),0_8px_24px_-6px_color-mix(in_oklab,var(--accent)_35%,transparent)] ring-1 ring-accent/15">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="min-w-0 whitespace-nowrap">
              {m.participants}: 5
            </span>
          </span>
        </motion.div>
      </Card.Header>
      <div className={`relative flex min-h-0 flex-1 flex-col ${stageShell}`}>{stageInner}</div>
    </Card>
  );

  const sidebar = (
    <div className="flex min-h-0 w-full min-w-0 flex-col gap-2 overflow-hidden sm:gap-3">
      <AccordionBlock title={m.upcoming} open={upcomingOpen} onToggle={() => setUpcomingOpen((v) => !v)}>
        <div className="flex flex-col gap-1.5 p-2 sm:p-2.5">
          {upcomingMeetings.length === 0 ? (
            <p className="m-0 px-1 py-2 text-[11px] text-[var(--muted)]">—</p>
          ) : (
            upcomingMeetings.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)]/50 bg-[var(--surface-secondary)]/35 px-2.5 py-2 sm:gap-2.5 sm:rounded-xl sm:px-3 sm:py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-xs font-semibold sm:text-sm">{row.title}</p>
                  <Text color="muted" className="m-0 mt-0.5 text-[10px] sm:text-xs">
                    {formatMeetingTime(row.scheduledAt)}
                  </Text>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 shrink-0 px-2.5 text-xs sm:h-9"
                  onPress={() => void handleJoinMeeting(row.id)}
                >
                  {m.join}
                </Button>
              </div>
            ))
          )}
        </div>
      </AccordionBlock>

      <AccordionBlock title={m.history} open={historyOpen} onToggle={() => setHistoryOpen((v) => !v)}>
        <div className="max-h-[min(220px,40vh)] overflow-y-auto overscroll-contain p-1.5 sm:max-h-[min(260px,42vh)] sm:p-2">
          {historyMeetings.length === 0 ? (
            <p className="m-0 px-2 py-2 text-[11px] text-[var(--muted)]">—</p>
          ) : (
            historyMeetings.map((row) => (
              <button
                key={row.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--surface-secondary)]/80 sm:gap-2.5 sm:rounded-xl sm:px-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/12 text-accent sm:h-8 sm:w-8 sm:rounded-lg">
                  <Call02Icon size={14} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium sm:text-sm">{row.title}</span>
                  <span className="mt-0.5 block text-[10px] text-[var(--muted)] sm:text-xs">
                    {formatMeetingTime(row.scheduledAt)} · {row.status}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </AccordionBlock>
    </div>
  );

  const gridStyleLg =
    isLg && !stageExpanded
      ? {
          gridTemplateColumns: sideOpen
            ? `0px minmax(${STAGE_COL_MIN_PX}px, 1fr) ${CHAT_PANEL_PX}px`
            : `minmax(260px,300px) minmax(0,1fr) 0px`,
          transition: GRID_COL_TRANSITION,
        }
      : undefined;

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 py-4 sm:gap-5 sm:py-5">
        <motion.header
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Call02Icon size={26} strokeWidth={1.75} className="text-accent" aria-hidden />
              <h1 className="m-0 text-2xl font-bold tracking-tight sm:text-3xl">{m.title}</h1>
              <Badge variant="soft" color="default" className="font-medium">
                {m.preview}
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)] sm:ml-10">{m.subtitle}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
            <Button variant="primary" size="sm" onPress={() => setNewRoomOpen(true)}>
              <Call02Icon size={16} strokeWidth={1.8} />
              {m.newRoom}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => {
                setScheduleDateVal((d: CalendarDate | null) => d ?? today(timeZone));
                setScheduleTimeVal((tv: Time | null) => tv ?? new Time(9, 0));
                setScheduleOpen(true);
              }}
            >
              <Calendar01Icon size={16} strokeWidth={1.8} />
              {m.scheduleMeeting}
            </Button>
          </div>
        </motion.header>

        <Dialog
          open={newRoomOpen}
          onOpenChange={(o) => {
            setNewRoomOpen(o);
            if (!o) setNewRoomName("");
          }}
        >
          <DialogContent from="top">
            <DialogHeader>
              <DialogTitle>{m.newRoomDialogTitle}</DialogTitle>
              <DialogDescription>{m.newRoomDialogDesc}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-1">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-[var(--foreground)]">{m.newRoomNameLabel}</Label>
                <Input
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder={m.newRoomNamePlaceholder}
                  aria-label={m.newRoomNameLabel}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary" size="sm">
                  {t.common.cancel}
                </Button>
              </DialogClose>
              <Button
                variant="primary"
                size="sm"
                onPress={() => void handleCreateInstantRoom()}
                isDisabled={!activeWorkspaceId}
              >
                {m.newRoomSubmit}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={scheduleOpen}
          onOpenChange={(o) => {
            setScheduleOpen(o);
            if (!o) {
              setScheduleTitle("");
              setScheduleDateVal(null);
              setScheduleTimeVal(null);
            }
          }}
        >
          <DialogContent from="top">
            <DialogHeader>
              <DialogTitle>{m.scheduleDialogTitle}</DialogTitle>
              <DialogDescription>{m.scheduleDialogDesc}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-1">
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-sm font-medium text-[var(--foreground)]">{m.newRoomNameLabel}</Label>
                <Input
                  value={scheduleTitle}
                  onChange={(e) => setScheduleTitle(e.target.value)}
                  placeholder={m.newRoomNamePlaceholder}
                  aria-label={m.newRoomNameLabel}
                />
              </div>
            </div>
            <div className="grid gap-4 py-1 sm:grid-cols-2">
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-sm font-medium text-[var(--foreground)]">{m.scheduleDateLabel}</Label>
                <DatePicker value={scheduleDateVal} onChange={setScheduleDateVal}>
                  <DatePicker.Trigger className="mt-1 flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 text-left text-sm text-[var(--foreground)] outline-none transition-colors hover:bg-[var(--surface-secondary)]/50">
                    <span className="min-w-0 flex-1 truncate">
                      {scheduleDateVal ? scheduleDateVal.toString() : m.scheduleDateLabel}
                    </span>
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                  <DatePicker.Popover>
                    <Calendar />
                  </DatePicker.Popover>
                </DatePicker>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-sm font-medium text-[var(--foreground)]">{m.scheduleTimeLabel}</Label>
                <TimeField value={scheduleTimeVal} onChange={setScheduleTimeVal} hourCycle={24}>
                  <TimeField.Group variant="secondary" fullWidth className="mt-1 w-full min-w-0">
                    <TimeField.InputContainer className="w-full">
                      <TimeField.Input className="w-full">
                        {(segment) => <TimeField.Segment segment={segment} />}
                      </TimeField.Input>
                    </TimeField.InputContainer>
                  </TimeField.Group>
                </TimeField>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary" size="sm">
                  {t.common.cancel}
                </Button>
              </DialogClose>
              <Button
                variant="primary"
                size="sm"
                onPress={() => void handleScheduleMeeting()}
                isDisabled={!activeWorkspaceId || !scheduleDateVal}
              >
                {m.scheduleSubmit}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div
          className={`grid min-h-0 flex-1 grid-cols-1 gap-3 sm:gap-4 ${stageExpanded ? "" : "lg:min-h-[360px]"}`}
          style={gridStyleLg as CSSProperties}
        >
          <aside
            className={`min-h-0 min-w-0 overflow-hidden ${stageExpanded ? "hidden" : ""} ${sideOpen && !isLg ? "hidden" : ""}`}
          >
            {sidebar}
          </aside>

          <div
            className={`flex min-h-[320px] min-w-0 flex-col gap-0 lg:min-h-0 ${stageExpanded ? "fixed inset-0 z-[60] m-0 flex h-dvh max-w-none min-h-0 flex-col items-stretch gap-3 p-3 sm:flex-row sm:gap-4 sm:p-4" : ""}`}
          >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div
                className="relative min-h-0 flex-1"
                style={{
                  borderRadius: stageExpanded ? 14 : 16,
                }}
              >
                <motion.div
                  animate={{
                    borderRadius: stageExpanded ? 12 : 16,
                    boxShadow: stageExpanded
                      ? "0 24px 80px -24px color-mix(in oklab, var(--foreground) 12%, transparent)"
                      : "0 0 0 0 transparent",
                  }}
                  transition={{
                    borderRadius: { type: "spring", stiffness: 260, damping: 32 },
                    boxShadow: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                  }}
                  className={`flex min-h-0 flex-col overflow-hidden ${stageExpanded ? "h-full min-h-0 flex-1" : "h-full min-h-0"}`}
                >
                  {stageCard}
                </motion.div>
              </div>

              {!stageExpanded && (
                <>
                  <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                    {[m.cap1, m.cap2, m.cap3, m.cap4].map((cap) => (
                      <span
                        key={cap}
                        className="rounded-full border border-[var(--border)]/60 bg-[var(--surface-secondary)]/50 px-2.5 py-0.5 text-[10px] font-medium text-[var(--muted)] sm:px-3 sm:py-1 sm:text-[11px]"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                  <p className="m-0 mt-1.5 text-center text-[10px] text-[var(--muted)] sm:mt-2 sm:text-xs">{m.note}</p>
                </>
              )}
            </div>

            {stageExpanded && sideOpen ? (
              <div
                className="flex min-h-0 w-full min-w-0 shrink-0 flex-col max-sm:min-h-[min(42dvh,360px)] sm:w-[min(100%,var(--cw))] sm:max-w-[min(100%,var(--cw))]"
                style={{ ["--cw" as string]: `${CHAT_PANEL_PX}px` }}
              >
                <div className="relative flex min-h-0 flex-1 overflow-hidden">
                  <div
                    className={`absolute inset-0 flex min-h-0 flex-col transition-opacity duration-150 ease-out motion-reduce:transition-none ${
                      sidePanel === "chat" ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
                    }`}
                    aria-hidden={sidePanel !== "chat"}
                  >
                    <ChatPanel
                      m={m}
                      onClose={closeSidePanel}
                      cancelLabel={t.common.cancel}
                      sendLabel={c.send}
                      inputPlaceholder={c.typeMessage}
                    />
                  </div>
                  <div
                    className={`absolute inset-0 flex min-h-0 flex-col transition-opacity duration-150 ease-out motion-reduce:transition-none ${
                      sidePanel === "people" ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
                    }`}
                    aria-hidden={sidePanel !== "people"}
                  >
                    <PeoplePanel m={m} onClose={closeSidePanel} cancelLabel={t.common.cancel} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div
            className={`min-h-0 min-w-0 overflow-hidden lg:col-start-3 lg:row-start-1 ${!isLg || stageExpanded ? "hidden" : ""}`}
          >
            <div className="relative h-full min-h-[280px] overflow-hidden rounded-2xl">
              <div
                className={`absolute inset-0 flex min-h-0 flex-col transition-opacity duration-150 ease-out motion-reduce:transition-none ${
                  sidePanel === "chat" ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
                }`}
                aria-hidden={sidePanel !== "chat"}
              >
                <ChatPanel
                  m={m}
                  onClose={closeSidePanel}
                  cancelLabel={t.common.cancel}
                  sendLabel={c.send}
                  inputPlaceholder={c.typeMessage}
                />
              </div>
              <div
                className={`absolute inset-0 flex min-h-0 flex-col transition-opacity duration-150 ease-out motion-reduce:transition-none ${
                  sidePanel === "people" ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
                }`}
                aria-hidden={sidePanel !== "people"}
              >
                <PeoplePanel m={m} onClose={closeSidePanel} cancelLabel={t.common.cancel} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isLg && !stageExpanded && (
        <div
          className={`fixed inset-0 z-[70] transition-opacity duration-150 ease-out motion-reduce:transition-none lg:hidden ${
            sideOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!sideOpen}
        >
          <button
            type="button"
            aria-label={t.common.cancel}
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={closeSidePanel}
          />
          <aside className="pointer-events-auto absolute inset-x-3 bottom-4 z-10 flex max-h-[min(72dvh,560px)] flex-col">
            <div className="relative flex min-h-[min(48dvh,420px)] min-w-0 flex-1 overflow-hidden rounded-2xl">
              <div
                className={`absolute inset-0 flex min-h-0 flex-col transition-opacity duration-150 ease-out motion-reduce:transition-none ${
                  sidePanel === "chat" ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
                }`}
                aria-hidden={sidePanel !== "chat"}
              >
                <ChatPanel
                  m={m}
                  onClose={closeSidePanel}
                  cancelLabel={t.common.cancel}
                  sendLabel={c.send}
                  inputPlaceholder={c.typeMessage}
                />
              </div>
              <div
                className={`absolute inset-0 flex min-h-0 flex-col transition-opacity duration-150 ease-out motion-reduce:transition-none ${
                  sidePanel === "people" ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
                }`}
                aria-hidden={sidePanel !== "people"}
              >
                <PeoplePanel m={m} onClose={closeSidePanel} cancelLabel={t.common.cancel} />
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
