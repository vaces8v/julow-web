"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, Input, InputGroup, Text } from "@heroui/react";
import {
  ArrowLeft01Icon,
  AttachmentIcon,
  Cancel01Icon,
  UserMultiple02Icon,
  Search01Icon,
} from "hugeicons-react";
import { Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useI18n } from "@/i18n/context";
import { ChatVideoPlayer } from "@/components/chat-video-player";
import { FileTypeIcon, extOf } from "@/lib/file-icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import { setActiveChatId } from "@/lib/active-chat";
import { api, type ChatPayload, type MessagePayload } from "@/lib/api";
import {
  subscribeChat,
  subscribeWsEvent,
  unsubscribeChat,
} from "@/lib/ws-client";

const HEADER_ROW =
  "box-border flex h-14 min-h-14 shrink-0 items-center gap-2 border-b border-[var(--border)]/70 px-3";

const PROJECT_CHAT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f97316", "#22c55e", "#ec4899"];

/** Минимальный профиль участника для аватара/имени в UI. */
type MemberInfo = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

/** Стабильный hash → цвет/инициалы из user_id (когда нет реальных данных профиля). */
function deriveMemberFallback(userId: string): MemberInfo {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  const color = PROJECT_CHAT_COLORS[Math.abs(h) % PROJECT_CHAT_COLORS.length];
  const initials = userId.slice(0, 2).toUpperCase();
  return { id: userId, name: userId.slice(0, 8), initials, color };
}

/** Лёгкое превью последнего сообщения чата. */
function previewFromMessages(msgs: MessagePayload[] | undefined): { text: string; at: string } | null {
  if (!msgs?.length) return null;
  const last = msgs[msgs.length - 1];
  let text = (last.content ?? "").trim();
  if (!text && last.attachments.length > 0) text = "📎";
  return { text, at: last.createdAt ?? "" };
}

/**
 * Расширения, считающиеся изображением/видео даже если backend не отдал
 * mime_type. Покрывает все основные форматы, которые сообщения чата принимают.
 */
const CHAT_IMAGE_EXTS = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "heic", "heif", "avif", "ico",
]);
const CHAT_VIDEO_EXTS = new Set([
  "mp4", "mov", "webm", "mkv", "avi", "m4v", "3gp",
]);

/**
 * Определяет тип вложения по mime_type (если есть) ИЛИ по расширению имени.
 * Поскольку backend для message attachments не всегда заполняет `mime_type`,
 * полагаться только на него нельзя — иначе jpg/png/mp4 уходят в `other` и
 * у пользователя нет превью.
 */
function attachmentKind(a: { mimeType?: string; filename?: string }): "image" | "video" | "other" {
  const mime = (a.mimeType ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  const ext = extOf(a.filename ?? "");
  if (CHAT_IMAGE_EXTS.has(ext)) return "image";
  if (CHAT_VIDEO_EXTS.has(ext)) return "video";
  return "other";
}

/** Человекочитаемый размер файла. */
function formatBytes(bytes?: number): string {
  if (bytes == null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/**
 * Локальные blob-превью для optimistic-скелетона: пользователь должен видеть
 * картинки/видео, которые он отправляет, ещё до того как backend ответит.
 *
 * Использует `URL.createObjectURL` и отзывает урлы на unmount, чтобы не
 * текли blobы.
 */
function OutgoingDraftFiles({ files }: { files: File[] }) {
  const previews = useMemo(() => {
    return files.map((f) => {
      const t = f.type.toLowerCase();
      const isImage = t.startsWith("image/") || CHAT_IMAGE_EXTS.has(extOf(f.name));
      const isVideo = t.startsWith("video/") || CHAT_VIDEO_EXTS.has(extOf(f.name));
      const url = isImage || isVideo ? URL.createObjectURL(f) : null;
      return { name: f.name, isImage, isVideo, url };
    });
  }, [files]);

  useEffect(() => {
    return () => {
      previews.forEach((p) => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
    };
  }, [previews]);

  return (
    <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {previews.map((p, i) =>
        p.isImage && p.url ? (
          <div
            key={`${p.name}-${i}`}
            className="relative h-32 w-full overflow-hidden rounded-lg bg-black/10"
          >
            <img
              src={p.url}
              alt={p.name}
              className="h-full w-full object-cover opacity-90"
            />
            <span className="absolute inset-0 animate-pulse bg-white/10" aria-hidden />
          </div>
        ) : p.isVideo && p.url ? (
          <div
            key={`${p.name}-${i}`}
            className="relative h-32 w-full overflow-hidden rounded-lg bg-black/30"
          >
            <video
              src={p.url}
              className="h-full w-full object-cover opacity-90"
              muted
              playsInline
            />
            <span className="absolute inset-0 animate-pulse bg-white/10" aria-hidden />
          </div>
        ) : (
          <div
            key={`${p.name}-${i}`}
            className="flex animate-pulse items-center gap-2 rounded-lg bg-white/20 px-2.5 py-1.5 text-[11px]"
          >
            <span className="block h-3 w-3 shrink-0 rounded-full bg-white/40" aria-hidden />
            <span className="truncate font-medium">{p.name}</span>
          </div>
        ),
      )}
    </div>
  );
}

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
  const { activeWorkspaceId } = useWorkspaceShell();
  const c = t.chats;
  /**
   * Deep-link через `?chat=<id>` — открывается из notification panel
   * (`app-shell.tsx`). Применяется один раз при mount, дальше пользователь
   * управляет выбором сам.
   */
  const searchParams = useSearchParams();
  const initialChatIdFromUrl = searchParams?.get("chat") ?? "";

  // ── Real backend state ────────────────────────────────────────
  const [chats, setChats] = useState<ChatPayload[]>([]);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, MessagePayload[]>>({});
  /** Кэш профилей участников по user_id. Заполняется по `getWorkspaceMembers` + fallback. */
  const [members, setMembers] = useState<Record<string, MemberInfo>>({});
  /** UUID текущего пользователя — нужен для определения "своих" сообщений (`isMe`). */
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState(initialChatIdFromUrl);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  /**
   * Optimistic «исходящее» сообщение для скелетона на время отправки и
   * загрузки вложений. Не попадает в `messagesByChat`, рендерится отдельным
   * пузырём в конце ленты с pulse-анимацией. Сбрасывается в finally.
   */
  const [outgoingDraft, setOutgoingDraft] = useState<{ text: string; files: File[] } | null>(null);
  /**
   * id сообщения, для которого ещё идёт upload вложений. Пока он задан,
   * скрываем «реальный» пузырь из `messagesByChat` (он может прилететь
   * через WS-обработчик `chat.message.created` ещё без attachments), чтобы
   * пользователь не видел его дважды рядом со скелетоном.
   */
  const [inFlightMessageId, setInFlightMessageId] = useState<string | null>(null);
  /**
   * Активный ли drag-over над тредом. Используется для подсветки drop-зоны
   * и показа overlay. Счётчик нужен, потому что dragenter/leave срабатывают
   * для каждого вложенного элемента и без него overlay мигает.
   */
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [mobileThread, setMobileThread] = useState(false);
  /**
   * Открыт ли side-sheet со списком участников выбранного чата.
   * Триггерится кликом на `MemberStack` в заголовке треда.
   */
  const [membersSheetOpen, setMembersSheetOpen] = useState(false);
  const messagesEndMobileRef = useRef<HTMLDivElement>(null);
  const messagesEndDesktopRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  /**
   * Перезагрузить список чатов из API.
   *
   * Используется как при первичном маунте, так и при realtime-уведомлениях,
   * сигнализирующих о новом чате/добавлении участника/сообщении в чат:
   * проектные чаты автоматически создаются Communication BC, поэтому
   * клиенту нужно догнать актуальный список без явного pull-to-refresh.
   */
  const reloadChats = useCallback(async () => {
    try {
      const chatList = await api.listChats();
      setChats(chatList);
    } catch {
      // ignore
    }
  }, []);

  // Загрузка чатов + текущего пользователя
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [chatList, me] = await Promise.all([
          api.listChats(),
          api.getMe().catch(() => null),
        ]);
        if (cancelled) return;
        setChats(chatList);
        if (me) setCurrentUserId(me.id);
      } catch {
        // ignore
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // Загрузка участников workspace для аватаров/имён
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    api.getWorkspaceMembers(activeWorkspaceId).then((mlist) => {
      if (cancelled) return;
      const next: Record<string, MemberInfo> = {};
      mlist.forEach((m) => {
        const fb = deriveMemberFallback(m.userId);
        next[m.userId] = {
          id: m.userId,
          name: m.displayName ?? fb.name,
          initials: (m.displayName ?? fb.name).slice(0, 2).toUpperCase(),
          color: fb.color,
        };
      });
      setMembers(next);
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [activeWorkspaceId]);

  /** Общий хелпер: профиль участника или fallback по UUID. */
  const memberOf = useCallback(
    (userId: string): MemberInfo => members[userId] ?? deriveMemberFallback(userId),
    [members],
  );

  const inferAttachmentType = (file: File): "image" | "video" | "file" => {
    const type = file.type.toLowerCase();
    if (type.startsWith("image/")) return "image";
    if (type.startsWith("video/")) return "video";
    return "file";
  };

  const addAttachmentFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setPendingAttachments((prev) => [...prev, ...Array.from(files)]);
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Авто-подгрузка сообщений выбранного чата (если ещё не загружали)
  useEffect(() => {
    if (!selectedId) return;
    if (messagesByChat[selectedId]) return;
    let cancelled = false;
    api.listMessages(selectedId, { limit: 100 }).then(({ items }) => {
      if (cancelled) return;
      setMessagesByChat((prev) => ({ ...prev, [selectedId]: items }));
      void api.markChatRead(selectedId).catch(() => { });
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [selectedId, messagesByChat]);

  // Realtime: подписка на push-уведомления.
  // Бэкенд шлёт `notification.created` с payload вида:
  //   { notification_type, title, body, chat_id?, message_id?, project_id?, ... }
  // Для чат-событий (chat_message / chat_member_added) перезагружаем список
  // чатов (на случай нового проектного чата) и сообщения активного чата.
  // Для project-* событий (joined/removed/archived/restored) тоже обновляем
  // список — Communication BC мог изменить набор чатов пользователя.
  useEffect(() => {
    const unsub = subscribeWsEvent("notification.created", (payload) => {
      const p = payload as
        | {
            notification_type?: string;
            chat_id?: string;
            project_id?: string;
            data?: { chat_id?: string; project_id?: string };
          }
        | null;
      const data = p?.data ?? {};
      const chatId = data.chat_id ?? p?.chat_id;
      const notifType = (p?.notification_type ?? "").toLowerCase();
      const projectId = data.project_id ?? p?.project_id;

      const isChatEvent =
        !!chatId ||
        notifType.startsWith("chat_") ||
        notifType === "chat_message" ||
        notifType === "chat_member_added";
      const isProjectEvent =
        !!projectId ||
        notifType.startsWith("project_") ||
        notifType === "project_member_joined";

      if (isChatEvent || isProjectEvent) {
        void reloadChats();
      }

      if (chatId && messagesByChat[chatId]) {
        // Обновляем кэш сообщений для известных чатов, чтобы превью и
        // лента селекта были свежими.
        api
          .listMessages(chatId, { limit: 100 })
          .then(({ items }) => {
            setMessagesByChat((prev) => ({ ...prev, [chatId]: items }));
            if (chatId === selectedId) {
              void api.markChatRead(chatId).catch(() => {});
            }
          })
          .catch(() => {});
      } else if (chatId && chatId === selectedId) {
        // Чат активен, но кэша ещё нет — обычная подгрузка.
        api
          .listMessages(chatId, { limit: 100 })
          .then(({ items }) => {
            setMessagesByChat((prev) => ({ ...prev, [chatId]: items }));
            void api.markChatRead(chatId).catch(() => {});
          })
          .catch(() => {});
      }
    });
    return unsub;
  }, [selectedId, messagesByChat, reloadChats]);

  /**
   * Гарантированный realtime: backend шлёт `chat.message.created` каждому
   * участнику чата напрямую через WebSocket (см. `OnMessageSentBroadcastWs`).
   * В отличие от `notification.created` это событие НЕ фильтруется по prefs/DND
   * пользователя — лента активного чата всегда обновляется в реальном времени.
   *
   * Полезная нагрузка: `{ chat_id, message_id, sender_id, message_type }`.
   * Полное содержимое сообщения подтягиваем через `listMessages` (упрощает
   * договорённость event payload и совпадает с существующим путём).
   */
  useEffect(() => {
    const unsub = subscribeWsEvent("chat.message.created", (payload) => {
      const p = payload as { chat_id?: string; sender_id?: string } | null;
      const chatId = p?.chat_id;
      if (!chatId) return;

      // Если этот чат уже отрендерён или открыт — обновляем ленту.
      const knownChat =
        !!messagesByChat[chatId] || chatId === selectedId;
      if (!knownChat) {
        // Чат пока не открывался: тихо обновим список (last_message_at).
        void reloadChats();
        return;
      }

      api
        .listMessages(chatId, { limit: 100 })
        .then(({ items }) => {
          setMessagesByChat((prev) => ({ ...prev, [chatId]: items }));
          if (chatId === selectedId) {
            void api.markChatRead(chatId).catch(() => { });
          }
        })
        .catch(() => { });
    });
    return unsub;
  }, [selectedId, messagesByChat, reloadChats]);

  /**
   * Сообщаем `app-shell` (через модуль-singleton), какой чат сейчас активен.
   * Это позволяет `app-shell.tsx` подавлять toast-уведомления о новых
   * сообщениях, если пользователь уже сидит в этом чате.
   *
   * Параллельно сообщаем БЭКЭНДУ через WebSocket: пока этот таб «слушает»
   * чат, не нужно создавать persisted notification про новые сообщения
   * в нём — мы и так увидим их в ленте через realtime
   * (`chat.message.created`). См. `OnMessageSentNotify` в backend'е.
   */
  useEffect(() => {
    setActiveChatId(selectedId || null);
    if (selectedId) {
      subscribeChat(selectedId);
    }
    return () => {
      setActiveChatId(null);
      if (selectedId) {
        unsubscribeChat(selectedId);
      }
    };
  }, [selectedId]);

  /**
   * Реагируем на смену `?chat=<id>` уже после монтирования: пользователь
   * мог быть на `/chats`, кликнуть уведомление и попасть на `/chats?chat=<id>`
   * — компонент не размонтируется, поэтому начальный `useState` не сработает.
   */
  useEffect(() => {
    const chatFromUrl = searchParams?.get("chat") ?? "";
    if (chatFromUrl && chatFromUrl !== selectedId) {
      setSelectedId(chatFromUrl);
      setMobileThread(true);
    }
    // selectedId намеренно не в deps: мы реагируем на смену именно URL,
    // а не на пользовательскую смену чата кликом в списке.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Группировка чатов: каналы (channel/group/announcement) vs DM
  const projectChats = useMemo(() => chats.filter((c) => c.chatType !== "dm"), [chats]);
  const directChats = useMemo(() => chats.filter((c) => c.chatType === "dm"), [chats]);

  const availableChatIds = useMemo(
    () => new Set(chats.map((c) => c.id)),
    [chats],
  );

  useEffect(() => {
    if (selectedId && availableChatIds.has(selectedId)) return;
    const nextSelectedId = projectChats[0]?.id ?? directChats[0]?.id ?? "";
    if (nextSelectedId === selectedId) return;
    queueMicrotask(() => setSelectedId(nextSelectedId));
  }, [availableChatIds, projectChats, directChats, selectedId]);

  const scrollThreadToBottom = useCallback(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const opts: ScrollIntoViewOptions = { behavior: reduce ? "instant" : "smooth", block: "end" };
    messagesEndMobileRef.current?.scrollIntoView(opts);
    messagesEndDesktopRef.current?.scrollIntoView(opts);
  }, []);

  /**
   * Авто-скролл к последнему сообщению при изменении ленты активного чата.
   * Срабатывает не только на собственный send (там уже есть явный вызов),
   * но и на realtime-доставку через `chat.message.created` — иначе новые
   * сообщения "уходят" под видимую область и пользователь не понимает,
   * что что-то пришло.
   */
  const lastMessageId = messagesByChat[selectedId]?.at(-1)?.id ?? "";
  useEffect(() => {
    if (!selectedId || !lastMessageId) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollThreadToBottom);
    });
  }, [selectedId, lastMessageId, scrollThreadToBottom]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projectChats;
    return projectChats.filter((g) => (g.name ?? "").toLowerCase().includes(q));
  }, [projectChats, query]);

  const filteredDirect = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return directChats;
    return directChats.filter((d) => {
      const peer = d.members.find((m) => m.userId !== currentUserId);
      const peerName = peer ? memberOf(peer.userId).name : "";
      return peerName.toLowerCase().includes(q);
    });
  }, [directChats, query, currentUserId, memberOf]);

  const selectedChat = chats.find((g) => g.id === selectedId);
  const selectedProject = selectedChat && selectedChat.chatType !== "dm" ? selectedChat : null;
  const selectedDm = selectedChat && selectedChat.chatType === "dm" ? selectedChat : null;
  const dmPeer = selectedDm ? selectedDm.members.find((m) => m.userId !== currentUserId) : null;
  const dmPeerProfile = dmPeer ? memberOf(dmPeer.userId) : null;

  const messages = messagesByChat[selectedId] ?? [];

  const openChat = (id: string) => {
    setSelectedId(id);
    setMobileThread(true);
  };

  const sendMessage = async () => {
    const text = draft.trim();
    const chatId = selectedId;
    if ((!text && pendingAttachments.length === 0) || !chatId || sendingMessage) return;
    const attachmentDraft = pendingAttachments;
    setDraft("");
    setPendingAttachments([]);
    setSendingMessage(true);
    setOutgoingDraft({ text, files: attachmentDraft });
    try {
      const newMsg = await api.sendMessage(chatId, { content: text });
      setInFlightMessageId(newMsg.id);
      let enrichedMessage = newMsg;
      for (const file of attachmentDraft) {
        try {
          const added = await api.addMessageAttachment(
            newMsg.id,
            file,
            inferAttachmentType(file),
          );
          enrichedMessage = {
            ...enrichedMessage,
            attachments: [...enrichedMessage.attachments, added],
          };
        } catch {
          // ignore one-file failures and keep the rest of the message
        }
      }
      // Dedupe by id: WS-обработчик `chat.message.created` уже мог
      // подтянуть это сообщение через listMessages — тогда оно есть
      // в списке без вложений. Заменяем на enrichedMessage, иначе
      // получаем дубликат react-key и теряем загруженные attachments.
      setMessagesByChat((prev) => {
        const existing = prev[chatId] ?? [];
        const idx = existing.findIndex((m) => m.id === enrichedMessage.id);
        const next =
          idx >= 0
            ? existing.map((m, i) => (i === idx ? enrichedMessage : m))
            : [...existing, enrichedMessage];
        return { ...prev, [chatId]: next };
      });
      queueMicrotask(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(scrollThreadToBottom);
        });
      });
    } catch {
      // restore draft on failure so the user doesn't lose input
      setDraft(text);
      setPendingAttachments(attachmentDraft);
    } finally {
      setSendingMessage(false);
      setOutgoingDraft(null);
      setInFlightMessageId(null);
    }
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
            {filteredProjects.map((g, idx) => {
              const color = g.color ?? PROJECT_CHAT_COLORS[idx % PROJECT_CHAT_COLORS.length];
              return (
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
                      style={{ backgroundColor: color }}
                    >
                      <UserMultiple02Icon size={20} strokeWidth={1.6} className="text-white/95" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold leading-tight">{g.name ?? g.id.slice(0, 8)}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
                        {c.groupLabel} · {c.membersCount.replace("{{count}}", String(g.members.length))}
                      </span>
                      <LastLine msgs={messagesByChat[g.id]} locale={locale} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mb-2 mt-4 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {c.sectionDirect}
          </p>
          <ul className="m-0 list-none space-y-0.5 p-0">
            {filteredDirect.map((d) => {
              const peerMember = d.members.find((m) => m.userId !== currentUserId);
              if (!peerMember) return null;
              const peer = memberOf(peerMember.userId);
              const preview = previewFromMessages(messagesByChat[d.id]);
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

  /**
   * Содержит ли DataTransfer файлы (а не просто текст/ссылку из браузера).
   * Без этой проверки overlay вылезал бы при drag any-text-выделения.
   */
  const dragHasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  const onThreadDragEnter = (e: React.DragEvent) => {
    if (!selectedId || sendingMessage || !dragHasFiles(e)) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragOver(true);
  };

  const onThreadDragLeave = (e: React.DragEvent) => {
    if (!selectedId || !dragHasFiles(e)) return;
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragOver(false);
  };

  const onThreadDragOver = (e: React.DragEvent) => {
    if (!selectedId || !dragHasFiles(e)) return;
    // preventDefault обязателен — иначе drop не сработает.
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  const onThreadDrop = (e: React.DragEvent) => {
    if (!selectedId || sendingMessage || !dragHasFiles(e)) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) addAttachmentFiles(files);
  };

  const renderThreadSection = (endRef: RefObject<HTMLDivElement | null>) =>
    selectedId &&
    (selectedProject || selectedDm) && (
    <motion.div
      key={selectedId}
      initial={{ opacity: 0.96 }}
      animate={{ opacity: 1 }}
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={onThreadDragEnter}
      onDragLeave={onThreadDragLeave}
      onDragOver={onThreadDragOver}
      onDrop={onThreadDrop}
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
              style={{ backgroundColor: selectedProject.color ?? PROJECT_CHAT_COLORS[0] }}
            >
              <UserMultiple02Icon size={20} strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="m-0 truncate text-sm font-semibold">{selectedProject.name ?? selectedProject.id.slice(0, 8)}</p>
              <p className="m-0 truncate text-[11px] text-[var(--muted)]">{c.defaultGroupHint}</p>
            </div>
            <MemberStack
              memberIds={selectedProject.members.map((m) => m.userId)}
              memberOf={memberOf}
              onClick={() => setMembersSheetOpen(true)}
              ariaLabel={c.membersSheetTitle}
            />
          </>
        )}
        {selectedDm && dmPeerProfile && (
          <>
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: dmPeerProfile.color }}
            >
              {dmPeerProfile.initials}
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="m-0 truncate text-sm font-semibold">{dmPeerProfile.name}</p>
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
            // Пока идёт upload вложений — прячем «реальный» пузырь, его роль
            // выполняет outgoingDraft-скелетон ниже.
            if (m.id === inFlightMessageId) return null;
            const author = memberOf(m.senderId);
            const isMe = m.senderId === currentUserId;
            const rowClass = `flex gap-2 ${isMe ? "flex-row-reverse" : ""}`;
            const at = m.createdAt ?? "";
            // Тип вложения определяем mime+ext: backend не всегда отдаёт
            // `mime_type` у message attachments, поэтому полагаться только
            // на него нельзя — иначе jpg/mp4 валились в `other`.
            const imageAttachments = m.attachments.filter((a) => attachmentKind(a) === "image");
            const videoAttachments = m.attachments.filter((a) => attachmentKind(a) === "video");
            const otherAttachments = m.attachments.filter((a) => attachmentKind(a) === "other");
            const bubble = (
              <>
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: author.color }}
                >
                  {author.initials}
                </div>
                <div
                  className={`max-w-[min(100%,420px)] min-w-0 rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    isMe
                      ? "rounded-tr-md bg-accent text-accent-foreground"
                      : "rounded-tl-md bg-[var(--surface-secondary)] text-[var(--foreground)]"
                  }`}
                >
                  {m.content ? <p className="m-0 whitespace-pre-wrap break-words">{m.content}</p> : null}
                  {imageAttachments.length > 0 ? (
                    <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {imageAttachments.map((a) => (
                        <a
                          key={a.id}
                          href={`/api/proxy/files/${a.fileId}/content`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="block overflow-hidden rounded-lg"
                          title={a.filename}
                        >
                          <img
                            src={`/api/proxy/files/${a.fileId}/content`}
                            alt={a.filename}
                            className="max-h-52 w-full cursor-zoom-in rounded-lg object-cover transition-transform hover:scale-[1.01]"
                            loading="lazy"
                          />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {videoAttachments.length > 0 ? (
                    <div className="mt-1.5 space-y-1.5">
                      {videoAttachments.map((a) => (
                        <ChatVideoPlayer key={a.id} src={`/api/proxy/files/${a.fileId}/content`} />
                      ))}
                    </div>
                  ) : null}
                  {otherAttachments.length > 0 ? (
                    <div className="mt-1.5 flex flex-col gap-1.5">
                      {otherAttachments.map((a) => {
                        const size = formatBytes(a.sizeBytes);
                        // Backend бывает не присылает имя файла — показываем
                        // хоть какой-то лейбл, чтобы плитка не выглядела
                        // безымянной "пустой" карточкой.
                        const label = a.filename?.trim() || c.attachmentFallback;
                        return (
                          <a
                            key={a.id}
                            href={`/api/proxy/files/${a.fileId}/content`}
                            target="_blank"
                            rel="noreferrer noopener"
                            download={a.filename || undefined}
                            className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left transition-colors ${
                              isMe
                                ? "border-white/20 bg-white/10 hover:bg-white/20"
                                : "border-[var(--border)]/60 bg-[var(--surface)] hover:bg-[var(--surface-secondary)]"
                            }`}
                            title={label}
                          >
                            <FileTypeIcon
                              filename={a.filename}
                              className="h-9 w-9"
                              iconSize={20}
                              tone={isMe ? "on-accent" : "default"}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-medium leading-tight">{label}</span>
                              {size ? (
                                <span className={`block text-[10.5px] ${isMe ? "text-white/70" : "text-[var(--muted)]"}`}>
                                  {size}
                                </span>
                              ) : null}
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <span
                  className={`self-end text-[10px] tabular-nums text-[var(--muted)] ${isMe ? "text-right" : ""}`}
                >
                  {at && formatTime(at, locale)}
                </span>
              </>
            );
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
          })}
          {outgoingDraft && currentUserId ? (() => {
            const author = memberOf(currentUserId);
            return (
              <motion.div
                key="outgoing-draft"
                layout
                className="flex flex-row-reverse gap-2"
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: author.color }}
                >
                  {author.initials}
                </div>
                <div className="max-w-[min(100%,420px)] min-w-0 rounded-2xl rounded-tr-md bg-accent/70 px-3.5 py-2 text-sm leading-relaxed text-accent-foreground">
                  {outgoingDraft.text ? (
                    <p className="m-0 whitespace-pre-wrap break-words opacity-90">{outgoingDraft.text}</p>
                  ) : null}
                  {outgoingDraft.files.length > 0 ? (
                    <OutgoingDraftFiles files={outgoingDraft.files} />
                  ) : null}
                  <span className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] text-accent-foreground/80">
                    <span
                      className="inline-block h-2 w-2 animate-pulse rounded-full bg-current"
                      aria-hidden
                    />
                    {c.sending}
                  </span>
                </div>
              </motion.div>
            );
          })() : null}
          {messages.length === 0 && !outgoingDraft && (
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
        <input
          ref={attachmentInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addAttachmentFiles(e.target.files);
            if (e.target) e.target.value = "";
          }}
        />
        {pendingAttachments.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingAttachments.map((file, index) => {
              const previewable = file.type.toLowerCase().startsWith("image/") || file.type.toLowerCase().startsWith("video/");
              return (
                <button
                  key={`${file.name}-${file.lastModified}-${index}`}
                  type="button"
                  onClick={() => removePendingAttachment(index)}
                  className="group flex items-center gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--surface-secondary)] px-2.5 py-1.5 text-left text-xs transition-colors hover:border-accent/40"
                >
                  {previewable ? (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--surface)] text-[10px] font-semibold uppercase text-[var(--muted)]">
                      {file.type.startsWith("video/") ? "VID" : "IMG"}
                    </span>
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{file.name}</span>
                    <span className="block text-[10px] text-[var(--muted)]">{c.clickToRemove}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        <form
          className="flex min-w-0 items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isIconOnly
            aria-label="Attach files"
            className="shrink-0"
            onPress={() => attachmentInputRef.current?.click()}
            isDisabled={sendingMessage}
          >
            <AttachmentIcon size={18} strokeWidth={1.6} />
          </Button>
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
            {(draft.trim() !== "" || pendingAttachments.length > 0) && (
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
                  isDisabled={sendingMessage}
                >
                  <Send className="size-[19px]" strokeWidth={2.25} aria-hidden />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            key="drop-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent/60 bg-accent/10 backdrop-blur-sm"
            aria-hidden
          >
            <AttachmentIcon size={36} strokeWidth={1.5} className="text-accent" />
            <span className="text-sm font-semibold text-accent">{c.dropToAttach}</span>
          </motion.div>
        )}
      </AnimatePresence>
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
                <Text color="muted">{c.emptySelect}</Text>
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
                  <Text color="muted">{c.emptySelect}</Text>
                </div>
              )}
            </div>
          </Panel>
        </Group>
      </Card>

      {/* Sheet со списком участников выбранного чата.
          Открывается кликом по `MemberStack` в заголовке треда. */}
      <AnimatePresence>
        {membersSheetOpen && selectedChat && (
          <ChatMembersSheet
            key="chat-members-sheet"
            chat={selectedChat}
            memberOf={memberOf}
            currentUserId={currentUserId}
            onClose={() => setMembersSheetOpen(false)}
            labels={c}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function LastLine({
  msgs,
  locale,
}: {
  msgs: MessagePayload[] | undefined;
  locale: "en" | "ru" | "de";
}) {
  const preview = previewFromMessages(msgs);
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

function MemberStack({
  memberIds,
  memberOf,
  onClick,
  ariaLabel,
}: {
  memberIds: string[];
  memberOf: (userId: string) => MemberInfo;
  /** Клик по аватарам открывает sheet со списком участников. */
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const show = memberIds.slice(0, 4);
  const rest = memberIds.length - show.length;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="hidden shrink-0 items-center -space-x-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-[var(--surface-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:flex disabled:cursor-default"
      disabled={!onClick}
    >
      {show.map((id) => {
        const p = memberOf(id);
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
    </button>
  );
}

/**
 * Side-sheet со списком всех участников чата.
 *
 * Источник данных — `chat.members` (уже есть в `ChatPayload`, без доп.
 * запросов). Имя/инициалы/цвет берём из общего `memberOf`-кэша,
 * заполненного через `getWorkspaceMembers`. Роли (`owner`, `admin`,
 * `member`, `guest`) маппятся в локализованные подписи.
 *
 * Поведение и стиль выровнены с `NotificationsSheet` из `app-shell.tsx`:
 * fixed top-right, slide-in от правого края, клик по backdrop'у — закрыть.
 */
function ChatMembersSheet({
  chat,
  memberOf,
  currentUserId,
  onClose,
  labels,
}: {
  chat: ChatPayload;
  memberOf: (userId: string) => MemberInfo;
  currentUserId: string | null;
  onClose: () => void;
  labels: {
    membersSheetTitle: string;
    membersSheetClose: string;
    membersCount: string;
    roleOwner: string;
    roleAdmin: string;
    roleMember: string;
    roleGuest: string;
    youSuffix: string;
  };
}) {
  const roleLabel = (role: string): string => {
    switch (role.toLowerCase()) {
      case "owner":
        return labels.roleOwner;
      case "admin":
        return labels.roleAdmin;
      case "guest":
        return labels.roleGuest;
      default:
        return labels.roleMember;
    }
  };

  // Сортируем: owner → admin → member → guest, далее по имени.
  const ROLE_ORDER: Record<string, number> = {
    owner: 0,
    admin: 1,
    member: 2,
    guest: 3,
  };
  const sortedMembers = [...chat.members].sort((a, b) => {
    const ra = ROLE_ORDER[a.role.toLowerCase()] ?? 9;
    const rb = ROLE_ORDER[b.role.toLowerCase()] ?? 9;
    if (ra !== rb) return ra - rb;
    return memberOf(a.userId).name.localeCompare(memberOf(b.userId).name);
  });

  /**
   * Кэш email-адресов по user_id для текущего sheet'а.
   *
   * Раньше под именем каждого участника писали `m.userId.slice(0, 8)`
   * (короткий UUID), что выглядело как технический шум. Теперь
   * подгружаем реальный email через `api.getUserById` для всех id,
   * которых ещё нет в `userEmails`. Запрос делаем один раз на смену
   * списка участников; повторно не дёргаем — параллельные вкладки/WS-
   * события дальше идут через общий `members` кэш родителя.
   *
   * Значение `null` означает «запрос упал» — для такого id фолбэкаем на
   * короткий UUID, чтобы строка не «прыгала» при ошибках сети.
   */
  const [userEmails, setUserEmails] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const missing = chat.members
      .map((m) => m.userId)
      .filter((id) => !(id in userEmails));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        api
          .getUserById(id)
          .then((u) => [id, u.email] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((results) => {
      if (cancelled) return;
      setUserEmails((prev) => {
        const next = { ...prev };
        for (const [id, email] of results) next[id] = email;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [chat.members, userEmails]);

  return (
    <>
      {/* Backdrop — кликабельный, чтобы закрывать sheet. */}
      <motion.div
        key="chat-members-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-90 bg-black/40 backdrop-blur-[2px]"
        aria-hidden
      />

      <motion.aside
        key="chat-members-sheet"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 40 }}
        role="dialog"
        aria-label={labels.membersSheetTitle}
        className="fixed top-0 right-0 z-100 h-dvh w-[360px] max-w-[100vw] overflow-hidden border-l border-[var(--border)]/60 bg-[var(--surface)] shadow-2xl"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)]/60 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-semibold leading-tight">
                {labels.membersSheetTitle}
              </p>
              <p className="m-0 mt-0.5 text-[11px] text-[var(--muted)]">
                {labels.membersCount.replace(
                  "{{count}}",
                  String(chat.members.length),
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={labels.membersSheetClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
            >
              <Cancel01Icon size={14} strokeWidth={2} />
            </button>
          </div>

          {/* List */}
          <ScrollArea className="flex-1">
            <ul className="m-0 list-none divide-y divide-[var(--border)]/30 p-0">
              {sortedMembers.map((m) => {
                const profile = memberOf(m.userId);
                const isMe = currentUserId === m.userId;
                return (
                  <li
                    key={m.userId}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ backgroundColor: profile.color }}
                    >
                      {profile.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[13px] font-semibold leading-tight">
                        {profile.name}
                        {isMe && (
                          <span className="ml-1.5 text-[11px] font-normal text-[var(--muted)]">
                            ({labels.youSuffix})
                          </span>
                        )}
                      </p>
                      {/* Под именем — email участника. Раньше тут стоял
                          короткий UUID (`m.userId.slice(0, 8)`), который
                          выглядел как технический шум. Теперь выводим
                          реальный email, подгруженный через `api.getUserById`
                          (см. `userEmails`-effect выше). Пока email грузится —
                          ничего не показываем (а не «прыгаем» с UUID на email),
                          в случае ошибки сети фолбэкаем на короткий UUID. */}
                      {(() => {
                        const cached = userEmails[m.userId];
                        if (cached === undefined) return null;
                        const text = cached ?? `${m.userId.slice(0, 8)}…`;
                        return (
                          <p className="m-0 mt-0.5 truncate text-[11px] text-[var(--muted)]/80">
                            {text}
                          </p>
                        );
                      })()}
                    </div>
                    <span className="shrink-0 rounded-md bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                      {roleLabel(m.role)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </div>
      </motion.aside>
    </>
  );
}
