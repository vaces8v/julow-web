"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Button, Card, Input, InputGroup, Text } from "@heroui/react";
import {
  ArrowLeft01Icon,
  UserMultiple02Icon,
  Search01Icon,
} from "hugeicons-react";
import { Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useI18n } from "@/i18n/context";
import { ChatVideoPlayer } from "@/components/chat-video-player";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import {
  CHAT_PEOPLE,
  DIRECT_CHATS,
  CHAT_MESSAGES,
  lastMessagePreview,
  personById,
  type ChatMessage,
  type ProjectGroupChat,
} from "@/data/chat-mock";

const HEADER_ROW =
  "box-border flex h-14 min-h-14 shrink-0 items-center gap-2 border-b border-[var(--border)]/70 px-3";

const PROJECT_CHAT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f97316", "#22c55e", "#ec4899"];

function formatTime(iso: string, loc: "en" | "ru" | "de") {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    const tag = loc === "ru" ? "ru-RU" : loc === "de" ? "de-DE" : "en-US";
    if (sameDay) {
      return d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString(tag, { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export function ChatsPage() {
  const { t, locale } = useI18n();
  const { projects } = useWorkspaceShell();
  const c = t.chats;
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [mobileThread, setMobileThread] = useState(false);
  const [extraByChat, setExtraByChat] = useState<Record<string, ChatMessage[]>>({});
  const messagesEndMobileRef = useRef<HTMLDivElement>(null);
  const messagesEndDesktopRef = useRef<HTMLDivElement>(null);
  const projectChats = useMemo<ProjectGroupChat[]>(
    () =>
      projects.map((project, index) => ({
        id: `pg-${project.id}`,
        kind: "project",
        projectId: project.id,
        name: project.name,
        color: project.color ?? PROJECT_CHAT_COLORS[index % PROJECT_CHAT_COLORS.length],
        memberIds: CHAT_PEOPLE.map((person) => person.id),
      })),
    [projects],
  );
  const availableChatIds = useMemo(
    () => new Set([...projectChats.map((chat) => chat.id), ...DIRECT_CHATS.map((chat) => chat.id)]),
    [projectChats],
  );

  useEffect(() => {
    if (selectedId && availableChatIds.has(selectedId)) return;
    const nextSelectedId = projectChats[0]?.id ?? DIRECT_CHATS[0]?.id ?? "";
    if (nextSelectedId === selectedId) return;
    queueMicrotask(() => setSelectedId(nextSelectedId));
  }, [availableChatIds, projectChats, selectedId]);

  const scrollThreadToBottom = useCallback(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const opts: ScrollIntoViewOptions = { behavior: reduce ? "instant" : "smooth", block: "end" };
    messagesEndMobileRef.current?.scrollIntoView(opts);
    messagesEndDesktopRef.current?.scrollIntoView(opts);
  }, []);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projectChats;
    return projectChats.filter((g) => g.name.toLowerCase().includes(q));
  }, [projectChats, query]);

  const filteredDirect = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DIRECT_CHATS;
    return DIRECT_CHATS.filter((d) => {
      const p = personById(d.peerId);
      return p?.name.toLowerCase().includes(q);
    });
  }, [query]);

  const selectedProject = projectChats.find((g) => g.id === selectedId);
  const selectedDm = DIRECT_CHATS.find((d) => d.id === selectedId);
  const messages = useMemo(() => {
    const base = CHAT_MESSAGES[selectedId] ?? [];
    const extra = extraByChat[selectedId] ?? [];
    return [...base, ...extra];
  }, [selectedId, extraByChat]);

  const openChat = (id: string) => {
    setSelectedId(id);
    setMobileThread(true);
  };

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || !selectedId) return;
    const msg: ChatMessage = {
      id: `local-${Date.now()}`,
      authorId: "u1",
      text,
      at: new Date().toISOString(),
    };
    setExtraByChat((prev) => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] ?? []), msg],
    }));
    setDraft("");
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollThreadToBottom);
      });
    });
  };

  /** Скругления как у пузырей сообщений (rounded-2xl), чтобы карточка и тред выглядели согласованно */
  const listShell =
    "flex min-h-0 flex-col overflow-hidden border-[var(--border)] md:border-r " +
    "rounded-2xl md:rounded-none md:rounded-bl-2xl md:rounded-tl-2xl md:rounded-br-none md:rounded-tr-none";

  const threadShell =
    "flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--background)]/40 " +
    "rounded-2xl md:rounded-none md:rounded-br-2xl md:rounded-tr-2xl md:rounded-bl-none md:rounded-tl-none";

  const listSection = (
    <>
      <div className={HEADER_ROW}>
        <InputGroup.Root
          fullWidth
          variant="primary"
          className="min-w-0 flex-1 border border-[var(--border)]/45 shadow-none"
        >
          <InputGroup.Prefix className="pointer-events-none text-[var(--muted)]">
            <Search01Icon size={18} strokeWidth={1.8} aria-hidden />
          </InputGroup.Prefix>
          <InputGroup.Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={c.searchPlaceholder}
            aria-label={c.searchPlaceholder}
            className="min-w-0"
          />
        </InputGroup.Root>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {c.sectionProjects}
          </p>
          <ul className="m-0 list-none space-y-0.5 p-0">
            {filteredProjects.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => openChat(g.id)}
                  className={`flex w-full min-w-0 items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors ${
                    selectedId === g.id
                      ? "bg-accent/12 text-[var(--foreground)]"
                      : "hover:bg-[var(--surface-secondary)]"
                  }`}
                >
                  <span
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                    style={{ backgroundColor: g.color }}
                  >
                    <UserMultiple02Icon size={20} strokeWidth={1.6} className="text-white/95" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold leading-tight">{g.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
                      {c.groupLabel} · {c.membersCount.replace("{{count}}", String(g.memberIds.length))}
                    </span>
                    <LastLine chatId={g.id} locale={locale} />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <p className="mb-2 mt-4 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {c.sectionDirect}
          </p>
          <ul className="m-0 list-none space-y-0.5 p-0">
            {filteredDirect.map((d) => {
              const peer = personById(d.peerId);
              if (!peer) return null;
              const preview = lastMessagePreview(d.id);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => openChat(d.id)}
                    className={`flex w-full min-w-0 items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors ${
                      selectedId === d.id
                        ? "bg-accent/12 text-[var(--foreground)]"
                        : "hover:bg-[var(--surface-secondary)]"
                    }`}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: peer.color }}
                    >
                      {peer.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold leading-tight">{peer.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">{c.directLabel}</span>
                      {preview && (
                        <PreviewLine text={preview.text} at={preview.at} locale={locale} />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </ScrollArea>
    </>
  );

  const renderThreadSection = (endRef: RefObject<HTMLDivElement | null>) =>
    selectedId &&
    (selectedProject || selectedDm) && (
    <motion.div
      key={selectedId}
      initial={{ opacity: 0.96 }}
      animate={{ opacity: 1 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        className={
          HEADER_ROW +
          " rounded-tl-2xl md:rounded-tl-2xl md:rounded-tr-2xl md:rounded-bl-none md:rounded-br-none"
        }
      >
        <Button
          isIconOnly
          size="sm"
          variant="secondary"
          className="md:hidden"
          onPress={() => setMobileThread(false)}
          aria-label={c.back}
        >
          <ArrowLeft01Icon size={18} />
        </Button>
        {selectedProject && (
          <>
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: selectedProject.color }}
            >
              <UserMultiple02Icon size={20} strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="m-0 truncate text-sm font-semibold">{selectedProject.name}</p>
              <p className="m-0 truncate text-[11px] text-[var(--muted)]">{c.defaultGroupHint}</p>
            </div>
            <MemberStack memberIds={selectedProject.memberIds} />
          </>
        )}
        {selectedDm && personById(selectedDm.peerId) && (
          <>
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: personById(selectedDm.peerId)!.color }}
            >
              {personById(selectedDm.peerId)!.initials}
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="m-0 truncate text-sm font-semibold">{personById(selectedDm.peerId)!.name}</p>
              <p className="m-0 truncate text-[11px] text-[var(--muted)]">{c.directLabel}</p>
            </div>
          </>
        )}
      </div>

      <ScrollArea
        className={
          "min-h-0 flex-1 px-3 " +
          "rounded-bl-2xl md:rounded-bl-2xl md:rounded-br-2xl md:rounded-tr-none md:rounded-tl-none"
        }
      >
        <div className="flex flex-col gap-3 py-4">
          {messages.map((m) => {
            const author = personById(m.authorId);
            const isMe = m.authorId === "u1";
            const isLocal = m.id.startsWith("local-");
            const rowClass = `flex gap-2 ${isMe ? "flex-row-reverse" : ""}`;
            const bubble = (
              <>
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: author?.color ?? "#64748b" }}
                >
                  {author?.initials ?? "?"}
                </div>
                <div
                  className={`max-w-[min(100%,420px)] min-w-0 rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    isMe
                      ? "rounded-tr-md bg-accent text-accent-foreground"
                      : "rounded-tl-md bg-[var(--surface-secondary)] text-[var(--foreground)]"
                  }`}
                >
                  {m.text ? <p className="m-0 whitespace-pre-wrap break-words">{m.text}</p> : null}
                  {m.imageUrl ? (
                    <img
                      src={m.imageUrl}
                      alt=""
                      className="mt-1.5 max-h-52 w-full rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  {m.videoUrl ? <ChatVideoPlayer src={m.videoUrl} /> : null}
                </div>
                <span
                  className={`self-end text-[10px] tabular-nums text-[var(--muted)] ${isMe ? "text-right" : ""}`}
                >
                  {formatTime(m.at, locale)}
                </span>
              </>
            );
            if (isLocal) {
              return (
                <motion.div
                  key={m.id}
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
              <div key={m.id} className={rowClass}>
                {bubble}
              </div>
            );
          })}
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--muted)]">{c.noMessages}</p>
          )}
        </div>
        <div ref={endRef} className="h-px w-full shrink-0" aria-hidden />
      </ScrollArea>

      <div
        className={
          "shrink-0 border-t border-[var(--border)]/70 p-3 " +
          "rounded-bl-2xl md:rounded-bl-none md:rounded-br-2xl"
        }
      >
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
              placeholder={c.typeMessage}
              aria-label={c.typeMessage}
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
                key="send"
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
                  aria-label={c.send}
                >
                  <Send className="size-[19px]" strokeWidth={2.25} aria-hidden />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </motion.div>
    );

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        {/* Мобильная вёрстка */}
        <div className="grid min-h-0 flex-1 grid-cols-1 basis-0 md:hidden">
          <div
            className={`${listShell} ${mobileThread ? "hidden" : "flex"} h-full min-h-0`}
          >
            {listSection}
          </div>

          <div
            className={`${threadShell} ${!mobileThread ? "hidden" : "flex"} h-full min-h-0`}
          >
            <AnimatePresence mode="popLayout">
              {renderThreadSection(messagesEndMobileRef)}
            </AnimatePresence>
            {!selectedId && (
              <div className="hidden flex-1 items-center justify-center p-8 text-center md:flex">
                <Text variant="muted">{c.emptySelect}</Text>
              </div>
            )}
          </div>
        </div>

        {/* ПК: resizable split */}
        <Group
          orientation="horizontal"
          id="chats-split"
          className="hidden min-h-0 flex-1 basis-0 md:flex"
          resizeTargetMinimumSize={{ fine: 12, coarse: 28 }}
        >
          <Panel
            id="chat-list"
            className="min-w-0"
            defaultSize="30%"
            minSize="260px"
            maxSize="52%"
          >
            <div className={`${listShell} flex h-full min-h-0 min-w-[260px] flex-col`}>{listSection}</div>
          </Panel>
          <Separator className="relative z-10 w-3 shrink-0 cursor-col-resize bg-transparent outline-none after:pointer-events-none after:absolute after:inset-y-2 after:left-1/2 after:h-[calc(100%-16px)] after:w-px after:-translate-x-1/2 after:rounded-full after:bg-accent after:opacity-0 after:transition-opacity hover:bg-accent/[0.07] hover:after:opacity-100 focus-visible:bg-accent/[0.09] focus-visible:after:opacity-100" />
          <Panel id="chat-thread" className="min-w-0" minSize="280px">
            <div className={`${threadShell} flex h-full min-h-0 flex-col`}>
              <AnimatePresence mode="popLayout">
                {renderThreadSection(messagesEndDesktopRef)}
              </AnimatePresence>
              {!selectedId && (
                <div className="flex flex-1 items-center justify-center p-8 text-center">
                  <Text variant="muted">{c.emptySelect}</Text>
                </div>
              )}
            </div>
          </Panel>
        </Group>
      </Card>
    </section>
  );
}

function LastLine({ chatId, locale }: { chatId: string; locale: "en" | "ru" | "de" }) {
  const preview = lastMessagePreview(chatId);
  if (!preview) return null;
  return <PreviewLine text={preview.text} at={preview.at} locale={locale} />;
}

/** Превью последнего сообщения: ровно до 2 строк с многоточием; перенос по словам, ширина следует сайдбару */
function PreviewLine({
  text,
  at,
  locale,
}: {
  text: string;
  at: string;
  locale: "en" | "ru" | "de";
}) {
  return (
    <div className="mt-0.5 flex min-w-0 gap-2 text-xs text-[var(--muted)]">
      <span className="min-w-0 flex-1 overflow-hidden break-words leading-snug line-clamp-2 [word-break:normal]">
        {text}
      </span>
      <span className="w-fit shrink-0 self-start pt-px text-right text-[10px] tabular-nums leading-snug opacity-80">
        {formatTime(at, locale)}
      </span>
    </div>
  );
}

function MemberStack({ memberIds }: { memberIds: string[] }) {
  const show = memberIds.slice(0, 4);
  const rest = memberIds.length - show.length;
  return (
    <div className="hidden shrink-0 items-center -space-x-2 sm:flex" aria-hidden>
      {show.map((id) => {
        const p = personById(id);
        if (!p) return null;
        return (
          <span
            key={id}
            title={p.name}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--surface)] text-[10px] font-bold text-white"
            style={{ backgroundColor: p.color }}
          >
            {p.initials}
          </span>
        );
      })}
      {rest > 0 && (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--surface-secondary)] text-[10px] font-semibold text-[var(--muted)]">
          +{rest}
        </span>
      )}
    </div>
  );
}
