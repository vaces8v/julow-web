"use client";

import { Badge, Button, Card, Text, cn } from "@heroui/react";
import {
  Add01Icon,
  Calendar01Icon,
  Cancel01Icon,
  Clock01Icon,
  Search01Icon,
} from "hugeicons-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/i18n/context";
import type { TaskPayload } from "@/lib/api";
import { api } from "@/lib/api";
import {
  getDayState,
  loadBundle,
  setDayState,
  setFocusSlots,
  setPresenceSelf,
  standUpsForDay,
  upsertMyStandUp,
} from "@/lib/today-storage";
import type { FocusSessionState, FocusSlots, PresencePreset } from "@/lib/today-types";
import {
  LOCAL_USER_ID,
  TODAY_FOCUS_MAX,
  dayKeyFromDate,
  emptyFocusSlots,
} from "@/lib/today-types";

/* ─── Utilities ──────────────────────────────────────────────────────────── */

function formatMmSs(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function elapsedSeconds(session: FocusSessionState, now: number): number {
  const seg = session.segmentStartedAt != null ? (now - session.segmentStartedAt) / 1000 : 0;
  return Math.min(session.targetSeconds, session.accumulatedSeconds + seg);
}

function pauseSession(session: FocusSessionState, now: number): FocusSessionState {
  if (session.segmentStartedAt == null) return session;
  return {
    ...session,
    accumulatedSeconds: session.accumulatedSeconds + (now - session.segmentStartedAt) / 1000,
    segmentStartedAt: null,
  };
}

const PRESENCE_DOT: Record<string, string> = {
  deep_work: "bg-accent",
  meeting: "bg-warning",
  need_help: "bg-danger",
  available: "bg-success",
};

/* ─── Animated checkbox ───────────────────────────────────────────────────── */
function TaskCheckbox({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.72 }}
      transition={{ type: "spring", stiffness: 500, damping: 18 }}
      className={cn(
        "relative flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
        done
          ? "border-accent bg-accent"
          : "border-[var(--border)] hover:border-accent/70",
      )}
      aria-label={done ? "Uncheck" : "Mark done"}
    >
      <AnimatePresence>
        {done && (
          <motion.svg
            key="check"
            initial={{ opacity: 0, scale: 0.2, rotate: -30 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.2 }}
            transition={{ type: "spring", stiffness: 620, damping: 20 }}
            width="11" height="11" viewBox="0 0 11 11" fill="none"
            className="text-accent-foreground"
          >
            <path
              d="M1.5 5.5L4 8L9.5 2.5"
              stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/* ─── Focus timer ring ───────────────────────────────────────────────────── */
function TimerRing({
  fraction,
  running,
  size = 100,
}: {
  fraction: number;
  running: boolean;
  size?: number;
}) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, fraction)));
  return (
    <div className="relative shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" className="stroke-[var(--border)]" strokeWidth="4"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          className="stroke-accent transition-[stroke-dashoffset] duration-700 ease-out"
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
        />
      </svg>
      {/* Running pulse dot */}
      <AnimatePresence>
        {running && (
          <motion.span
            key="pulse"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [1, 0.25, 1], scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ opacity: { duration: 1.6, repeat: Infinity, ease: "easeInOut" }, scale: { duration: 0.2 } }}
            className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-accent"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export function TodayPage() {
  const { locale, t } = useI18n();
  const td = t.today;
  const { activeWorkspaceId, projects } = useWorkspaceShell();

  const dayKey = useMemo(() => dayKeyFromDate(new Date()), []);
  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString(
        locale === "de" ? "de-DE" : locale === "ru" ? "ru-RU" : "en-US",
        { weekday: "long", day: "numeric", month: "long" },
      ),
    [locale],
  );

  const [bundle, setBundle] = useState(() => loadBundle(activeWorkspaceId || "default"));
  const [tick, setTick] = useState(() => Date.now());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickIndex, setPickIndex] = useState<number | null>(null);
  const [taskQuery, setTaskQuery] = useState("");
  const [tasks, setTasks] = useState<TaskPayload[]>([]);

  const projectName = useCallback(
    (id: string) => {
      const p = projects.find((proj) => proj.id === id);
      return p?.name ?? id;
    },
    [projects],
  );
  const patchBundle = useCallback((next: typeof bundle) => setBundle(next), []);

  // Fetch real tasks from API when workspace changes
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    api.getTasks(activeWorkspaceId).then((list) => {
      if (!cancelled) setTasks(list);
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    queueMicrotask(() => setBundle(loadBundle(activeWorkspaceId)));
  }, [activeWorkspaceId]);

  /* 1-second tick + timer auto-pause when done */
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setTick(now);
      if (!activeWorkspaceId) return;
      setBundle((prev) => {
        const ds = getDayState(prev, dayKey);
        const s = ds.focusSession;
        if (!s?.segmentStartedAt) return prev;
        if (elapsedSeconds(s, now) < s.targetSeconds - 0.5) return prev;
        return setDayState(activeWorkspaceId, prev, dayKey, {
          focusSession: pauseSession(s, now),
        });
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeWorkspaceId, dayKey]);

  /* Derived */
  const dayState = useMemo(() => getDayState(bundle, dayKey), [bundle, dayKey]);
  const slots = dayState.focusSlots ?? emptyFocusSlots();
  const doneSet = useMemo(() => new Set(dayState.doneTaskIds ?? []), [dayState.doneTaskIds]);
  const filledCount = slots.filter(Boolean).length;
  const doneCount = slots.filter((id) => id && doneSet.has(id)).length;
  const allDone = filledCount === TODAY_FOCUS_MAX && doneCount === TODAY_FOCUS_MAX;

  const taskById = useMemo(() => {
    const m = new Map<string, TaskPayload>();
    for (const x of tasks) m.set(x.id, x);
    return m;
  }, [tasks]);

  /* Slot actions */
  const onSlotsChange = useCallback(
    (next: FocusSlots) => {
      if (!activeWorkspaceId) return;
      patchBundle(setFocusSlots(activeWorkspaceId, bundle, dayKey, next));
    },
    [activeWorkspaceId, bundle, dayKey, patchBundle],
  );

  const clearSlot = (i: number) => {
    const next: FocusSlots = [...slots];
    next[i] = null;
    onSlotsChange(next);
  };

  const toggleDone = (taskId: string) => {
    if (!activeWorkspaceId) return;
    const next = new Set(doneSet);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    patchBundle(setDayState(activeWorkspaceId, bundle, dayKey, { doneTaskIds: [...next] }));
  };

  /* Picker */
  const openPicker = (i: number) => {
    setPickIndex(i);
    setTaskQuery("");
    setPickerOpen(true);
  };
  const pickTask = (taskId: string) => {
    if (pickIndex == null || !activeWorkspaceId) return;
    const next: FocusSlots = [...slots];
    next[pickIndex] = taskId;
    onSlotsChange(next);
    setPickerOpen(false);
    setPickIndex(null);
  };
  const filteredPickTasks = useMemo(() => {
    const q = taskQuery.trim().toLowerCase();
    const used = new Set(
      slots.flatMap((id, i) => (id && i !== pickIndex ? [id] : [])) as string[],
    );
    return tasks.filter((task) => {
      if (used.has(task.id)) return false;
      if (!q) return true;
      return (
        task.title.toLowerCase().includes(q) ||
        projectName(task.projectId).toLowerCase().includes(q)
      );
    });
  }, [taskQuery, tasks, slots, pickIndex, projectName]);

  /* Day note */
  const updateDayNote = (dayNote: string) => {
    if (!activeWorkspaceId) return;
    patchBundle(setDayState(activeWorkspaceId, bundle, dayKey, { dayNote }));
  };

  /* Stand-up */
  const standUp = dayState.myStandUp ?? { yesterday: "", today: "", blockers: "" };
  const setStandUpField = (field: keyof typeof standUp, value: string) => {
    if (!activeWorkspaceId) return;
    patchBundle(
      setDayState(activeWorkspaceId, bundle, dayKey, {
        myStandUp: { ...standUp, [field]: value },
      }),
    );
  };
  const submitStandUp = () => {
    if (!activeWorkspaceId) return;
    patchBundle(
      upsertMyStandUp(
        activeWorkspaceId, bundle, dayKey,
        { yesterday: standUp.yesterday, today: standUp.today, blockers: standUp.blockers },
        "You",
      ),
    );
  };

  /* Presence */
  const onPresence = (preset: PresencePreset) => {
    if (!activeWorkspaceId) return;
    patchBundle(setPresenceSelf(activeWorkspaceId, bundle, preset));
  };

  /* Timer */
  const session = dayState.focusSession;
  const firstFocusTaskId = slots.find((x) => x != null) ?? null;
  const isRunning = !!(session?.segmentStartedAt);

  const setTimerSession = (next: FocusSessionState | null) => {
    if (!activeWorkspaceId) return;
    patchBundle(setDayState(activeWorkspaceId, bundle, dayKey, { focusSession: next }));
  };
  const startTimer = (seconds: number) => {
    if (!firstFocusTaskId) return;
    setTimerSession({
      taskId: firstFocusTaskId,
      targetSeconds: seconds,
      accumulatedSeconds: 0,
      segmentStartedAt: Date.now(),
    });
  };
  const togglePause = () => {
    if (!session) return;
    if (session.segmentStartedAt != null) setTimerSession(pauseSession(session, tick));
    else setTimerSession({ ...session, segmentStartedAt: Date.now() });
  };
  const resetTimer = () => setTimerSession(null);

  const timerRemaining = session
    ? Math.max(0, session.targetSeconds - elapsedSeconds(session, tick))
    : 0;
  const ringFraction = session ? timerRemaining / session.targetSeconds : 0;

  /* Presets */
  const presets: { id: PresencePreset; label: string }[] = [
    { id: "deep_work", label: td.presetDeep },
    { id: "meeting", label: td.presetMeeting },
    { id: "available", label: td.presetAvailable },
    { id: "need_help", label: td.presetHelp },
  ];
  const standUps = standUpsForDay(bundle, dayKey);
  const myPresence = bundle.presence.find((p) => p.userId === LOCAL_USER_ID);

  if (!activeWorkspaceId) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Text variant="muted">{t.common.loading}</Text>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12 pt-6 sm:px-6 lg:pt-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26 }}
          className="mb-8 space-y-3"
        >
          <p className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <Calendar01Icon size={13} strokeWidth={2.5} />
            {td.title}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-[28px]">
            {dateLabel}
          </h1>

          {/* 3-dot progress */}
          <div className="flex items-center gap-2.5">
            {slots.map((slotId, i) => {
              const done = !!(slotId && doneSet.has(slotId));
              const has = !!slotId;
              return (
                <motion.span
                  key={i}
                  animate={done ? { scale: [1, 1.6, 1] } : {}}
                  transition={{ type: "spring", stiffness: 400, damping: 18, duration: 0.4 }}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition-colors duration-300",
                    done
                      ? "bg-accent"
                      : has
                        ? "bg-accent/30"
                        : "border-2 border-[var(--border)]",
                  )}
                />
              );
            })}
            <span className="ml-0.5 text-sm text-[var(--muted)]">
              {td.doneOf.replace("{{done}}", String(doneCount))}
            </span>
          </div>
        </motion.header>

        {/* ── Two-column grid ─────────────────────────────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_356px] xl:items-start xl:gap-8">

          {/* ── Left: My Day ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* TODAY'S TASKS */}
            <Card className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
              <div className="border-b border-[var(--border)] px-5 py-4">
                <h2 className="text-sm font-semibold text-[var(--foreground)]">{td.tasksTitle}</h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{td.tasksHint}</p>
              </div>

              <div className="flex flex-col gap-1 p-3">
                <AnimatePresence mode="popLayout">
                  {slots.map((taskId, i) => {
                    const task = taskId ? taskById.get(taskId) : undefined;
                    const done = !!(taskId && doneSet.has(taskId));

                    return task ? (
                      /* Filled slot */
                      <motion.div
                        key={taskId}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: done ? 0.55 : 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                          done
                            ? "bg-transparent"
                            : "bg-[var(--surface-secondary)]/30 hover:bg-[var(--surface-secondary)]/55",
                        )}
                      >
                        <TaskCheckbox done={done} onToggle={() => toggleDone(taskId!)} />

                        {/* Task info */}
                        <div className="relative min-w-0 flex-1">
                          <p className={cn(
                            "text-sm font-medium leading-snug transition-colors duration-200",
                            done ? "text-[var(--muted)]" : "text-[var(--foreground)]",
                          )}>
                            {task.title}
                          </p>
                          {/* Animated strikethrough line */}
                          <AnimatePresence>
                            {done && (
                              <motion.div
                                key="strike"
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                exit={{ scaleX: 0 }}
                                transition={{ duration: 0.22, ease: "easeOut" }}
                                className="absolute left-0 top-[0.6em] h-px w-full origin-left bg-[var(--muted)]/70"
                              />
                            )}
                          </AnimatePresence>
                          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                            {projectName(task.projectId)}
                          </p>
                        </div>

                        {/* Remove (visible on hover) */}
                        <button
                          type="button"
                          onClick={() => clearSlot(i)}
                          className="shrink-0 rounded-lg p-1 text-[var(--muted)] opacity-0 transition-all hover:text-[var(--foreground)] group-hover:opacity-100"
                          aria-label={td.clearSlot}
                        >
                          <Cancel01Icon size={13} />
                        </button>
                      </motion.div>
                    ) : (
                      /* Empty slot */
                      <motion.button
                        key={`empty-${i}`}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        type="button"
                        onClick={() => openPicker(i)}
                        disabled={filledCount >= TODAY_FOCUS_MAX}
                        whileTap={{ scale: 0.985 }}
                        className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border)] px-3 py-2.5 text-sm text-[var(--muted)] transition-colors hover:border-accent/50 hover:bg-accent/[0.04] hover:text-accent disabled:cursor-not-allowed disabled:opacity-25"
                      >
                        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-dashed border-current">
                          <Add01Icon size={11} strokeWidth={2.5} />
                        </span>
                        {td.addFromTasks}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>

                {/* All done celebration */}
                <AnimatePresence>
                  {allDone && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="mt-1 rounded-xl bg-success/10 px-4 py-2.5 text-center text-sm font-medium text-success"
                    >
                      {td.allDone}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>

            {/* FOCUS TIMER */}
            <Card className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
              <div className="border-b border-[var(--border)] px-5 py-4">
                <div className="flex items-center gap-2">
                  <Clock01Icon size={14} strokeWidth={2.5} className="text-accent" />
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">{td.timerTitle}</h2>
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{td.timerIntro}</p>
              </div>

              <div className="flex items-center gap-5 px-5 py-5">
                {/* Ring */}
                <div className="relative flex shrink-0 items-center justify-center">
                  <TimerRing fraction={ringFraction} running={isRunning} size={104} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono text-[22px] font-bold tabular-nums text-[var(--foreground)]">
                      {session ? formatMmSs(timerRemaining) : "—"}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-1 flex-col gap-3">
                  {/* Current focus task label */}
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {td.focusOn}
                    </p>
                    <p className={cn("truncate text-sm font-medium", firstFocusTaskId ? "text-[var(--foreground)]" : "text-[var(--muted)]")}>
                      {firstFocusTaskId
                        ? (taskById.get(firstFocusTaskId)?.title ?? "—")
                        : td.timerIdleHint}
                    </p>
                  </div>

                  {/* Duration presets */}
                  <div className="flex gap-2">
                    <Button
                      size="sm" variant="secondary"
                      onPress={() => startTimer(25 * 60)}
                      isDisabled={!firstFocusTaskId || isRunning}
                    >
                      {td.minutes25}
                    </Button>
                    <Button
                      size="sm" variant="secondary"
                      onPress={() => startTimer(50 * 60)}
                      isDisabled={!firstFocusTaskId || isRunning}
                    >
                      {td.minutes50}
                    </Button>
                  </div>

                  {/* Start / Pause / Reset */}
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onPress={togglePause} isDisabled={!session}>
                      {isRunning ? td.pause : td.start}
                    </Button>
                    <Button size="sm" variant="ghost" onPress={resetTimer} isDisabled={!session}>
                      {td.reset}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* DAY NOTE */}
            <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-sm">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">{td.wrapTitle}</h2>
              <p className="mt-0.5 mb-3 text-xs text-[var(--muted)]">{td.noteHint}</p>
              <textarea
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm leading-relaxed text-[var(--foreground)] placeholder:text-[var(--muted)]/50 transition-colors focus:border-accent/60 focus:outline-none"
                placeholder={td.wrapPlaceholder}
                value={dayState.dayNote}
                onChange={(e) => updateDayNote(e.target.value)}
              />
            </Card>
          </div>

          {/* ── Right: Team ──────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* STATUS */}
            <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">{td.presenceTitle}</h2>
              <p className="mt-0.5 mb-4 text-xs text-[var(--muted)]">{td.presenceSet}</p>

              <div className="grid grid-cols-2 gap-2">
                {presets.map((p) => {
                  const active = myPresence?.preset === p.id;
                  return (
                    <motion.button
                      key={p.id}
                      type="button"
                      onClick={() => onPresence(p.id)}
                      whileTap={{ scale: 0.91 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors",
                        active
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-[var(--border)] text-[var(--muted)] hover:border-accent/40 hover:text-[var(--foreground)]",
                      )}
                    >
                      <motion.span
                        animate={active ? { scale: [1, 1.5, 1] } : { scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full transition-colors duration-200",
                          active ? PRESENCE_DOT[p.id] : "bg-[var(--border)]",
                        )}
                      />
                      {p.label}
                    </motion.button>
                  );
                })}
              </div>

              {/* Team list */}
              {bundle.presence.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-[var(--border)]/50 pt-4">
                  {bundle.presence.map((p) => {
                    const preset = presets.find((x) => x.id === p.preset);
                    return (
                      <li key={p.userId} className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            PRESENCE_DOT[p.preset] ?? "bg-[var(--muted)]",
                          )}
                        />
                        <span className="flex-1 truncate text-sm text-[var(--foreground)]">
                          {p.userName}
                        </span>
                        <span className="text-xs text-[var(--muted)]">
                          {preset?.label ?? p.preset}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* STAND-UP */}
            <Card className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
              <div className="border-b border-[var(--border)] px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">
                    {td.standUpTitle}
                  </h2>
                  <AnimatePresence>
                    {dayState.myStandUp && (
                      <motion.span
                        key="posted-badge"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={{ type: "spring", stiffness: 520, damping: 22 }}
                        className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path
                            d="M1.5 5L3.5 7L8.5 2.5"
                            stroke="currentColor" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round"
                          />
                        </svg>
                        {td.standUpPosted}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{td.teamIntro}</p>
              </div>

              <div className="space-y-3 p-5">
                {(["yesterday", "today", "blockers"] as const).map((field) => (
                  <div key={field} className="space-y-1.5">
                    <label className="block text-xs font-medium text-[var(--muted)]">
                      {field === "yesterday"
                        ? td.standUpYesterday
                        : field === "today"
                          ? td.standUpToday
                          : td.standUpBlockers}
                    </label>
                    <input
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 transition-colors focus:border-accent/60 focus:outline-none"
                      placeholder="…"
                      value={standUp[field]}
                      onChange={(e) => setStandUpField(field, e.target.value)}
                    />
                  </div>
                ))}

                <motion.button
                  type="button"
                  onClick={submitStandUp}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className="mt-1 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
                >
                  {td.standUpSubmit}
                </motion.button>
              </div>
            </Card>

            {/* TEAM FEED */}
            <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">{td.feedTitle}</h2>
              <div className="mt-3 flex flex-col gap-2">
                {standUps.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--border)] py-7 text-center">
                    <p className="text-sm text-[var(--muted)]">{td.noStandUps}</p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {standUps.map((post) => (
                      <motion.li
                        key={post.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                        className="rounded-xl border border-[var(--border)]/50 bg-[var(--surface-secondary)]/20 p-4"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--foreground)]">
                            {post.userName}
                          </span>
                          {post.userId === LOCAL_USER_ID && (
                            <Badge variant="soft" size="sm" color="accent">
                              {td.you}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1 text-xs text-[var(--muted)]">
                          <p>
                            <span className="font-medium text-[var(--foreground)]">
                              {td.standUpYesterday}:
                            </span>{" "}
                            {post.yesterday || "—"}
                          </p>
                          <p>
                            <span className="font-medium text-[var(--foreground)]">
                              {td.standUpToday}:
                            </span>{" "}
                            {post.today || "—"}
                          </p>
                          {post.blockers && (
                            <p>
                              <span className="font-medium text-danger">
                                {td.standUpBlockers}:
                              </span>{" "}
                              {post.blockers}
                            </p>
                          )}
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Task picker dialog ──────────────────────────────────────────────── */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[min(560px,90vh)] gap-0 overflow-hidden border-[var(--border)] bg-[var(--surface)] p-0 shadow-2xl sm:max-w-lg">
          <DialogHeader className="border-b border-[var(--border)] px-5 py-4">
            <DialogTitle>{td.pickTaskTitle}</DialogTitle>
            <DialogDescription>{td.searchTasks}</DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-3 pt-4">
            <div className="relative">
              <Search01Icon
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 transition-colors focus:border-accent/60 focus:outline-none"
                placeholder={td.searchTasks}
                value={taskQuery}
                onChange={(e) => setTaskQuery(e.target.value)}
              />
            </div>
          </div>
          <ScrollArea className="max-h-[min(360px,50vh)] px-5 pb-5">
            <div className="flex flex-col gap-1.5 pr-1">
              {filteredPickTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="rounded-xl border border-[var(--border)]/50 bg-[var(--surface-secondary)]/20 px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/[0.05]"
                  onClick={() => pickTask(task.id)}
                >
                  <span className="block text-sm font-medium text-[var(--foreground)]">
                    {task.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {projectName(task.projectId)}
                  </span>
                </button>
              ))}
              {filteredPickTasks.length === 0 && (
                <p className="py-10 text-center text-sm text-[var(--muted)]">
                  {t.dashboard.noTasksYet}
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
