"use client";

import {
  Button,
  Calendar,
  DatePicker,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Select,
  Text,
  TimeField,
} from "@heroui/react";
import { CalendarDate, Time, getLocalTimeZone, today } from "@internationalized/date";
import { ArrowDown01Icon, Calendar01Icon, Call02Icon } from "hugeicons-react";
import { motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
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
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/context";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import { useLiveMeeting } from "@/components/live-meeting-context";
import { api, type MeetingPayload, type ProjectPayload } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { subscribeWsEvent } from "@/lib/ws-client";

function ProjectSelect({
  value,
  onChange,
  projects,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  projects: ProjectPayload[];
  placeholder: string;
  disabled: boolean;
}) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const handleContainerRef = useCallback((node: HTMLDivElement | null) => {
    setPortalContainer(node?.closest("[data-slot='dialog-content']") as HTMLElement | null);
  }, []);
  const all =
    value && !projects.find((p) => p.id === value)
      ? [{ id: value, name: value } as ProjectPayload, ...projects]
      : projects;
  const current = all.find((p) => p.id === value);
  return (
    <div ref={handleContainerRef} className="w-full">
      <Select
        selectedKey={value}
        onSelectionChange={(key) => {
          if (key != null) onChange(String(key));
        }}
        isDisabled={disabled}
        className="w-full"
      >
        <Select.Trigger className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 text-left text-sm text-[var(--foreground)] outline-none transition-colors hover:bg-[var(--surface-secondary)]/50 disabled:opacity-60">
          <Select.Value className="min-w-0 flex-1 truncate">{current?.name ?? placeholder}</Select.Value>
          <ArrowDown01Icon size={16} strokeWidth={1.9} className="shrink-0 text-[var(--muted)]" />
        </Select.Trigger>
        <Select.Popover
          UNSTABLE_portalContainer={portalContainer ?? undefined}
          className="z-50 min-w-[var(--trigger-width)] rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] p-1 shadow-lg"
        >
          <ListBox className="max-h-64 overflow-auto outline-none">
            {all.map((p) => (
              <ListBoxItem
                key={p.id}
                id={p.id}
                textValue={p.name}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--foreground)] outline-none hover:bg-[var(--surface-secondary)] data-[selected]:bg-accent/10 data-[selected]:text-accent"
              >
                {p.name}
              </ListBoxItem>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
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

export function MeetingsPage() {
  const { t, locale } = useI18n();
  const m = t.meetings;
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspaceShell();
  const liveMeeting = useLiveMeeting();
  const hasActiveMeeting = Boolean(liveMeeting.meetingId && liveMeeting.token);

  // Clear justLeft on mount so future navigations to this page work normally.
  useEffect(() => {
    if (liveMeeting.justLeft) {
      liveMeeting.clearJustLeft();
    }
  }, [liveMeeting.justLeft, liveMeeting.clearJustLeft]);

  // Optimistic redirect: if user is already in a meeting, push to the room
  // immediately and render nothing — prevents the meetings-list flash.
  // Skip if user just intentionally left.
  useEffect(() => {
    if (liveMeeting.justLeft) return;
    if (hasActiveMeeting) {
      router.replace(`/meetings/${liveMeeting.meetingId}/room`);
    }
  }, [hasActiveMeeting, liveMeeting.meetingId, liveMeeting.justLeft, router]);

  const [activeOpen, setActiveOpen] = useState(true);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDateVal, setScheduleDateVal] = useState<CalendarDate | null>(null);
  const [scheduleTimeVal, setScheduleTimeVal] = useState<Time | null>(null);
  // Project selection (mandatory): video meetings can only be created inside
  // a project so that all project members are auto-invited and notified.
  const [projects, setProjects] = useState<ProjectPayload[]>([]);
  const [newRoomProjectId, setNewRoomProjectId] = useState<string>("");
  const [scheduleProjectId, setScheduleProjectId] = useState<string>("");
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

  useEffect(() => {
    api.getMe().then((u) => setCurrentUserId(u.id)).catch(() => { });
  }, []);

  // Список проектов текущего пользователя — обязательный контекст
  // для видеовстреч: все участники выбранного проекта будут
  // приглашены в комнату.
  useEffect(() => {
    let cancelled = false;
    api.getMyProjects().then((list) => {
      if (cancelled) return;
      setProjects(list);
    }).catch(() => { });
    return () => { cancelled = true; };
  }, []);

  // Realtime: бэкенд публикует `notification.created` для каждого
  // участника, когда встреча создана / обновлена. Любое meeting-* /
  // meeting_-уведомление обновляет список встреч.
  useEffect(() => {
    const unsub = subscribeWsEvent("notification.created", (payload) => {
      const p = payload as { notification_type?: string } | null;
      const t = (p?.notification_type ?? "").toLowerCase();
      if (t.startsWith("meeting_") || t.includes("meeting")) {
        setRefreshKey((k) => k + 1);
      }
    });
    return unsub;
  }, []);

  /**
   * Делим митинги на upcoming/history по статусу. Завершённые/отменённые → история,
   * остальные (`scheduled`, `in_progress`) → предстоящие. Дополнительная фильтрация
   * по времени делалась бы здесь, но `Date.now()` в render считается impure.
   */
  const activeMeetings = useMemo(() => {
    return meetings
      .filter((mt) => {
        const status = mt.status?.toLowerCase() ?? "";
        return status === "in_progress";
      })
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  }, [meetings]);

  const upcomingMeetings = useMemo(() => {
    return meetings
      .filter((mt) => {
        const status = mt.status?.toLowerCase() ?? "";
        return status === "scheduled" || status === "draft";
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

  const formatMeetingStatus = useCallback((status?: string) => {
    const s = (status ?? "").toLowerCase();
    if (s === "draft") return m.statusDraft;
    if (s === "scheduled") return m.statusScheduled;
    if (s === "in_progress") return m.statusInProgress;
    if (s === "completed") return m.statusCompleted;
    if (s === "cancelled") return m.statusCancelled;
    return status ?? "—";
  }, [m.statusCancelled, m.statusCompleted, m.statusDraft, m.statusInProgress, m.statusScheduled]);

  const handleJoinMeeting = useCallback(
    (meetingId: string) => {
      router.push(`/meetings/${meetingId}/room`);
    },
    [router],
  );

  const showMeetingCreateError = useCallback((err: unknown) => {
    if (err instanceof ApiError) {
      if (err.code === "INSUFFICIENT_MEETING_CREATE_PERMISSIONS") {
        toast.error(m.createFailedTitle, {
          description: m.createPermissionDenied,
        });
        return;
      }
      toast.error(m.createFailedTitle, {
        description: err.detail ?? m.createFailedDescription,
      });
      return;
    }
    if (err instanceof Error) {
      toast.error(m.createFailedTitle, {
        description: err.message || m.createFailedDescription,
      });
      return;
    }
    toast.error(m.createFailedTitle, {
      description: m.createFailedDescription,
    });
  }, [m.createFailedDescription, m.createFailedTitle, m.createPermissionDenied]);

  /**
   * Собирает всех активных участников проекта — бекенд добавит
   * каждого как `MeetingParticipant`, что инициирует ин-апп уведомление
   * (`MeetingParticipantAdded` → `OnMeetingParticipantAddedNotify`).
   * Организатор (текущий пользователь) исключается — бэкенд
   * автоматически регистрирует его в `Meeting.create()`.
   */
  const fetchProjectParticipantIds = useCallback(
    async (workspaceId: string, projectId: string): Promise<string[]> => {
      try {
        const members = await api.getProjectMembers(workspaceId, projectId);
        return members
          .filter((member) => member.isActive !== false)
          .map((member) => member.userId)
          .filter((id): id is string => Boolean(id) && id !== currentUserId);
      } catch {
        return [];
      }
    },
    [currentUserId],
  );

  const handleCreateInstantRoom = useCallback(async () => {
    if (!activeWorkspaceId || !newRoomProjectId) return;
    const title = newRoomName.trim() || m.newRoom;
    try {
      const participantIds = await fetchProjectParticipantIds(
        activeWorkspaceId,
        newRoomProjectId,
      );
      const meeting = await api.createMeeting({
        workspaceId: activeWorkspaceId,
        projectId: newRoomProjectId,
        title,
        meetingType: "video_call",
        participantIds,
      });
      await api.startMeeting(meeting.id).catch(() => { });
      setNewRoomName("");
      setNewRoomProjectId("");
      setNewRoomOpen(false);
      setRefreshKey((k) => k + 1);
      handleJoinMeeting(meeting.id);
    } catch (err) {
      showMeetingCreateError(err);
    }
  }, [activeWorkspaceId, newRoomName, newRoomProjectId, m.newRoom, handleJoinMeeting, fetchProjectParticipantIds, showMeetingCreateError]);

  const handleEndMeeting = useCallback(async (meetingId: string) => {
    if (!confirm(m.endMeetingConfirm)) return;
    setEndingId(meetingId);
    try {
      await api.completeMeeting(meetingId);
      setRefreshKey((k) => k + 1);
    } catch {
      // ignore
    } finally {
      setEndingId(null);
    }
  }, [m.endMeetingConfirm]);

  const handleScheduleMeeting = useCallback(async () => {
    if (!activeWorkspaceId || !scheduleDateVal || !scheduleProjectId) return;
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
      const participantIds = await fetchProjectParticipantIds(
        activeWorkspaceId,
        scheduleProjectId,
      );
      await api.createMeeting({
        workspaceId: activeWorkspaceId,
        projectId: scheduleProjectId,
        title,
        meetingType: "video_call",
        scheduledAt: dt.toISOString(),
        durationMinutes: 30,
        participantIds,
      });
      setScheduleTitle("");
      setScheduleProjectId("");
      setScheduleDateVal(null);
      setScheduleTimeVal(null);
      setScheduleOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showMeetingCreateError(err);
    }
  }, [activeWorkspaceId, scheduleDateVal, scheduleTimeVal, scheduleTitle, scheduleProjectId, m.scheduleMeeting, fetchProjectParticipantIds, showMeetingCreateError]);

  const sidebar = (
    <div className="flex min-h-0 w-full min-w-0 flex-col gap-2 overflow-hidden sm:gap-3">
      {/* ── Active meetings ── */}
      {activeMeetings.length > 0 && (
        <AccordionBlock title={m.active} open={activeOpen} onToggle={() => setActiveOpen((v) => !v)}>
          <div className="flex flex-col gap-1.5 p-2 sm:p-2.5">
            {activeMeetings.map((row) => {
              const isOrganizer = currentUserId === row.organizerId;
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-2 sm:gap-2.5 sm:rounded-xl sm:px-3 sm:py-2"
                >
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-xs font-semibold sm:text-sm">{row.title}</p>
                    <Text color="muted" className="m-0 mt-0.5 text-[10px] sm:text-xs">
                      {formatMeetingTime(row.scheduledAt)}
                    </Text>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 px-2.5 text-xs sm:h-9"
                      onPress={() => void handleJoinMeeting(row.id)}
                    >
                      {m.join}
                    </Button>
                    {isOrganizer && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 px-2 text-xs text-red-500 hover:text-red-600 sm:h-9"
                        onPress={() => void handleEndMeeting(row.id)}
                        isDisabled={endingId === row.id}
                      >
                        {endingId === row.id ? m.ending : m.endMeeting}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </AccordionBlock>
      )}

      {/* ── Upcoming meetings ── */}
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

      {/* ── History ── */}
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
                    {formatMeetingTime(row.scheduledAt)} · {formatMeetingStatus(row.status)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </AccordionBlock>
    </div>
  );

  // Optimistic: don't render the meetings list if we're about to redirect
  if (hasActiveMeeting && !liveMeeting.justLeft) return null;

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col">
      <div className="mr-auto flex w-full max-w-[1080px] flex-1 flex-col gap-4 py-4 sm:gap-5 sm:py-5">
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
            if (!o) {
              setNewRoomName("");
              setNewRoomProjectId("");
            }
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
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-[var(--foreground)]">{m.projectLabel}</Label>
                <ProjectSelect
                  value={newRoomProjectId}
                  onChange={setNewRoomProjectId}
                  projects={projects}
                  placeholder={projects.length === 0 ? m.noProjectsHint : m.projectPlaceholder}
                  disabled={projects.length === 0}
                />
                <p className="m-0 text-[11px] text-[var(--muted)]">
                  {newRoomProjectId ? m.projectMembersInfo : m.projectRequired}
                </p>
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
                isDisabled={!activeWorkspaceId || !newRoomProjectId}
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
              setScheduleProjectId("");
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
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-sm font-medium text-[var(--foreground)]">{m.projectLabel}</Label>
                <ProjectSelect
                  value={scheduleProjectId}
                  onChange={setScheduleProjectId}
                  projects={projects}
                  placeholder={projects.length === 0 ? m.noProjectsHint : m.projectPlaceholder}
                  disabled={projects.length === 0}
                />
                <p className="m-0 text-[11px] text-[var(--muted)]">
                  {scheduleProjectId ? m.projectMembersInfo : m.projectRequired}
                </p>
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
                isDisabled={!activeWorkspaceId || !scheduleDateVal || !scheduleProjectId}
              >
                {m.scheduleSubmit}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <aside className="min-h-0 w-full max-w-sm">
          {sidebar}
        </aside>
      </div>
    </section>
  );
}
