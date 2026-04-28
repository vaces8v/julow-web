/**
 * Мок-данные чатов: группа на каждый проект + личные переписки.
 * В группу проекта по умолчанию входят все участники команды.
 */

export type Person = {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
};

export const CHAT_PEOPLE: Person[] = [
  { id: "u1", name: "Alexey K.", role: "Tech Lead", initials: "A", color: "#3b82f6" },
  { id: "u2", name: "Marina V.", role: "Product", initials: "M", color: "#8b5cf6" },
  { id: "u3", name: "Denis P.", role: "Full-stack", initials: "D", color: "#f97316" },
  { id: "u4", name: "Olga S.", role: "Design", initials: "O", color: "#06b6d4" },
  { id: "u5", name: "Pavel N.", role: "QA", initials: "P", color: "#22c55e" },
  { id: "u6", name: "Irina M.", role: "Frontend", initials: "I", color: "#ec4899" },
];

/** Синхронизировано с PROJECT_TABS в app-shell */
export const PROJECT_CHAT_META = [
  { projectId: "julow-web", name: "Julow Web App", color: "#3b82f6" },
  { projectId: "mobile-client", name: "Mobile Client", color: "#8b5cf6" },
  { projectId: "api-gateway", name: "API Gateway", color: "#06b6d4" },
  { projectId: "design-system", name: "Design System", color: "#f97316" },
  { projectId: "documentation", name: "Documentation", color: "#22c55e" },
] as const;

const ALL_MEMBER_IDS = CHAT_PEOPLE.map((p) => p.id);

export type ProjectGroupChat = {
  id: string;
  kind: "project";
  projectId: string;
  name: string;
  color: string;
  /** все участники workspace в канале проекта по умолчанию */
  memberIds: string[];
};

export type DirectChat = {
  id: string;
  kind: "direct";
  peerId: string;
};

export type ChatRoom = ProjectGroupChat | DirectChat;

export const PROJECT_GROUP_CHATS: ProjectGroupChat[] = PROJECT_CHAT_META.map((p) => ({
  id: `pg-${p.projectId}`,
  kind: "project",
  projectId: p.projectId,
  name: p.name,
  color: p.color,
  memberIds: [...ALL_MEMBER_IDS],
}));

export const DIRECT_CHATS: DirectChat[] = [
  { id: "dm-u2", kind: "direct", peerId: "u2" },
  { id: "dm-u3", kind: "direct", peerId: "u3" },
  { id: "dm-u4", kind: "direct", peerId: "u4" },
];

export type ChatMessage = {
  id: string;
  authorId: string;
  text: string;
  at: string;
  /** превью изображения в треде */
  imageUrl?: string;
  /** встроенное видео (URL mp4/webm) */
  videoUrl?: string;
};

const now = Date.now();
const mins = (m: number) => new Date(now - m * 60_000).toISOString();

export const CHAT_MESSAGES: Record<string, ChatMessage[]> = {
  "pg-julow-web": [
    { id: "m1", authorId: "u2", text: "Макеты главной готовы — гляните тред в Figma.", at: mins(12) },
    { id: "m2", authorId: "u1", text: "Ок, сегодня после синка пройдусь по комментариям.", at: mins(10) },
    {
      id: "m1a",
      authorId: "u4",
      text: "",
      imageUrl: "https://picsum.photos/seed/julow-chat/640/360",
      at: mins(11),
    },
    { id: "m3", authorId: "u5", text: "Добавил чек-лист регресса к релизу пятницы.", at: mins(4) },
    {
      id: "m1b",
      authorId: "u1",
      text: "Короткое демо:",
      videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      at: mins(6),
    },
  ],
  "pg-mobile-client": [
    { id: "m4", authorId: "u3", text: "Push-уведомления: ветка готова к ревью.", at: mins(45) },
    { id: "m5", authorId: "u6", text: "Заберу после мержа API.", at: mins(40) },
  ],
  "pg-api-gateway": [
    { id: "m6", authorId: "u1", text: "Rate limit для публичного API — черновик в Notion.", at: mins(120) },
  ],
  "pg-design-system": [
    { id: "m7", authorId: "u4", text: "Токены для dark mode обновила, смотрите ветку `theme/dark`.", at: mins(200) },
  ],
  "pg-documentation": [
    { id: "m8", authorId: "u2", text: "Онбординг для новых разработчиков — нужен ревьюер.", at: mins(300) },
  ],
  "dm-u2": [
    { id: "d1", authorId: "u2", text: "Сможешь глянуть PR по онбордингу?", at: mins(90) },
    { id: "d2", authorId: "u1", text: "Да, после обеда отпишусь.", at: mins(85) },
  ],
  "dm-u3": [
    { id: "d3", authorId: "u3", text: "Логи на стейдже странные — скину trace id.", at: mins(30) },
  ],
  "dm-u4": [
    { id: "d4", authorId: "u4", text: "Иконки для тайм-трекера — ок если до среды?", at: mins(15) },
  ],
};

export function lastMessagePreview(chatId: string): { text: string; at: string } | null {
  const list = CHAT_MESSAGES[chatId];
  if (!list?.length) return null;
  const last = list[list.length - 1];
  let text = last.text?.trim() ?? "";
  if (!text) {
    if (last.imageUrl) text = "📷";
    else if (last.videoUrl) text = "▶";
  }
  return { text, at: last.at };
}

export function personById(id: string): Person | undefined {
  return CHAT_PEOPLE.find((p) => p.id === id);
}
