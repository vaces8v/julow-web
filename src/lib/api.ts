/**
 * Julow Web API — real backend integration.
 * Replaces the previous mock implementation with actual HTTP calls.
 *
 * TODO(arch): файл перевалил 1000 строк. По плану julow-mvp-backend-integration
 * следующим шагом разбить на `lib/api/index.ts` (re-export) + `lib/api/auth.ts`,
 * `lib/api/workspace.ts`, `lib/api/project.ts`, `lib/api/task.ts`,
 * `lib/api/communication.ts`, `lib/api/filestorage.ts`. Внешний импорт
 * `import { api } from "@/lib/api"` должен сохраниться неизменным.
 */

import {
  apiDelete,
  apiGet,
  apiGetPaginated,
  apiPatch,
  apiPost,
  apiPostMultipart,
  authLogin,
  authLogout,
  authMe,
  authRegister,
  ApiError,
} from "./api-client";

// ── Payload types (compatible with existing UI) ────────────────

export interface WorkspacePayload {
  id: string;
  name: string;
  slug: string;
}

export interface ProjectPayload {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  status: string;
  methodology: string;
  /**
   * UUID пользователей-владельцев проекта (`owner_ids` с бэкенда).
   * Создатель проекта попадает сюда автоматически. UI использует этот
   * список, чтобы решить, доступно ли редактирование имени/описания
   * (только владельцу).
   */
  ownerIds: string[];
}

export interface TaskPayload {
  id: string;
  title: string;
  status: string;
  /** UUID workflow-статуса (то, что бэкенд ждёт в `new_status_id`). */
  statusId?: string;
  /** UUID колонки доски (board column), если задача привязана к доске. */
  columnId?: string;
  priority: string;
  dueDate?: string;
  startDate?: string;
  labels: string[];
  projectId: string;
  taskType?: string;
  assigneeIds: string[];
  reporterId?: string;
  progress?: number;
  sprintId?: string;
  epicId?: string;
  parentTaskId?: string;
  createdAt?: string;
  completedAt?: string;
}

export interface ChecklistItemPayload {
  id: string;
  text: string;
  isChecked: boolean;
  assigneeId?: string;
  dueDate?: string;
  checkedAt?: string;
  order: number;
}

export interface ChecklistPayload {
  id: string;
  title: string;
  items: ChecklistItemPayload[];
}

export interface TaskRelationPayload {
  relatedTaskId: string;
  relationType: string;
  createdAt: string;
  createdBy: string;
}

export interface TaskAttachmentPayload {
  fileId: string;
  filename: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface TaskWatcherPayload {
  userId: string;
  watchedAt: string;
}

/**
 * Полная карточка задачи. Используется в task-detail dialog.
 * `TaskPayload` остаётся для списков (board / today) и совместим с TaskDetailPayload.
 */
export interface TaskDetailPayload extends TaskPayload {
  description?: string;
  descriptionFormat?: string;
  checklists: ChecklistPayload[];
  relations: TaskRelationPayload[];
  watchers: TaskWatcherPayload[];
  attachments: TaskAttachmentPayload[];
  customFields: Record<string, string>;
}

export interface TaskChangelogEntryPayload {
  id: string;
  fieldName: string;
  oldValue?: string | null;
  newValue?: string | null;
  changedAt: string;
  changedBy: string;
}

export interface SprintPayload {
  id: string;
  projectId: string;
  name: string;
  goal?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
}

export interface EpicPayload {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: string;
  color?: string;
  startDate?: string;
  endDate?: string;
}

export interface BoardColumnPayload {
  id: string;
  name: string;
  statusMapping: string | null;
  position?: number;
  wipLimit?: number | null;
}

export interface WorkflowStatusPayload {
  id: string;
  name: string;
  category: string; // "todo" | "in_progress" | "done" | "cancelled" | "blocked" | "review"
  order: number;
  isDefault: boolean;
}

export interface CommentPayload {
  id: string;
  targetType: string;
  targetId: string;
  authorId: string;
  content: string;
  contentFormat: string;
  parentCommentId?: string;
  attachments: CommentAttachmentShape[];
  createdAt: string;
  updatedAt?: string;
  isPinned: boolean;
}

export interface CommentAttachmentShape {
  id: string;
  fileId: string;
  url?: string;
  attachmentType?: string;
  name?: string;
  sizeBytes?: number;
  previewUrl?: string;
  createdAt?: string;
}

// ── Communication BC ─────────────────────────────────────────

export type ChatType = "dm" | "group" | "channel" | "announcement";

export interface ChatMemberShape {
  userId: string;
  role: string;
  joinedAt?: string;
  lastReadAt?: string;
}

export interface ChatPayload {
  id: string;
  chatType: ChatType;
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  workspaceId?: string;
  /** UUID связанного проекта — заполнен только для системных проектных чатов. */
  projectId?: string;
  members: ChatMemberShape[];
  isArchived: boolean;
  lastMessageAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MessageReactionShape {
  emoji: string;
  userIds: string[];
}

export interface MessageAttachmentShape {
  id: string;
  fileId: string;
  filename: string;
  sizeBytes?: number;
  mimeType?: string;
}

export interface MessagePayload {
  id: string;
  chatId: string;
  threadId?: string;
  senderId: string;
  content?: string;
  contentFormat: string;
  messageType: string;
  replyToId?: string;
  attachments: MessageAttachmentShape[];
  reactions: MessageReactionShape[];
  isEdited: boolean;
  isDeleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MeetingParticipantShape {
  userId: string;
  isMandatory: boolean;
  rsvpStatus: string;
  joinedAt?: string;
}

export interface MeetingPayload {
  id: string;
  title: string;
  description?: string;
  meetingType: string;
  status: string;
  scheduledAt?: string;
  durationMinutes?: number;
  location?: string;
  conferenceUrl?: string;
  conferenceProvider: string;
  workspaceId: string;
  projectId?: string;
  organizerId: string;
  participants: MeetingParticipantShape[];
  agenda: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MeetingJoinPayload {
  joinUrl: string;
  accessToken?: string;
  provider: string;
}

// ── FileStorage BC ───────────────────────────────────────────

export interface FolderPayload {
  id: string;
  name: string;
  folderType: string;
  parentFolderId?: string;
  color?: string;
  description?: string;
  icon?: string;
  ownerId: string;
  workspaceId: string;
  projectId?: string;
  isPinned: boolean;
  isShared: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FileTagPayload {
  id: string;
  name: string;
  color?: string;
}

export interface ShareLinkPayload {
  id: string;
  token: string;
  hasPassword: boolean;
  expiresAt?: string;
  accessLevel: string;
  allowDownload: boolean;
  maxUses?: number;
  currentUses: number;
  createdBy: string;
  createdAt?: string;
}

export interface FilePayload {
  id: string;
  name: string;
  originalName: string;
  fileType: string;
  sizeBytes: number;
  mimeType: string;
  storageId: string;
  folderId?: string;
  uploaderId: string;
  workspaceId: string;
  ownerId: string;
  description?: string;
  status: string;
  scanStatus: string;
  isShared: boolean;
  isLocked: boolean;
  tags: FileTagPayload[];
  shareLinks: ShareLinkPayload[];
  previewPath?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FileDownloadPayload {
  url: string;
  expiresIn: number;
  fileId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AnalyticsPayload {
  throughput: number;
  overdue: number;
  statusDistribution: Record<string, number>;
  totalTasks: number;
}

/**
 * Уведомление из Notification BC (`GET /notifications/`).
 *
 * Поля мапятся 1:1 на `NotificationResponse` бэкенда, но в camelCase.
 * `data` — произвольный контекст события (например, `{ task_id, project_id }`),
 * который UI может использовать для построения deep-link'а.
 */
export interface NotificationPayload {
  id: string;
  recipientId: string;
  workspaceId?: string;
  notificationType: string;
  title: string;
  body: string;
  priority: string;
  data: Record<string, unknown>;
  channels: string[];
  isRead: boolean;
  readAt?: string;
  isArchived: boolean;
  actorId?: string;
  createdAt?: string;
}

/**
 * Счётчик непрочитанных уведомлений (`GET /notifications/unread-count`).
 * `byWorkspace` — мапа `workspace_id → count`, удобно для badge'й
 * в табах рабочих пространств, если понадобится.
 */
export interface UnreadCountPayload {
  total: number;
  byWorkspace: Record<string, number>;
}

/**
 * Метаданные для подключения к real-time уведомлениям по WebSocket.
 * Источник — `GET /notifications/connection-info`. Бэкенд возвращает:
 *   - `websocketUrl` — полный URL WS-эндпоинта (например,
 *     `ws://host:8000/api/v1/ws/notifications` в dev или `wss://...`
 *     в проде). URL строится на бэкенде из `settings.app.host/port`.
 *   - `authMethod` / `authParam` — как передавать JWT (сейчас `query` + `token`).
 *   - `heartbeatIntervalSec` — раз в сколько секунд клиент шлёт `"ping"`.
 *   - `serverEvents` / `clientMessages` — справочно, для логов и тестов.
 *
 * Клиент должен сам приложить JWT (см. `/api/auth/ws-token`).
 */
export interface NotificationConnectionInfo {
  websocketUrl: string;
  authMethod: string;
  authParam: string;
  heartbeatIntervalSec: number;
  serverEvents: string[];
  clientMessages: string[];
}

/**
 * Типизированное WS-событие от бэкенда уведомлений.
 *
 * Бэкенд отправляет JSON `{event_type, payload}`. Для `notification.created`
 * payload содержит плоский объект `{ notification_type, title, body, ...data }`,
 * но **без** id уведомления — поэтому консьюмерам нужно ре-фетчить список,
 * если они хотят полную карточку.
 *
 * Остальные события (`read` / `all_read` / `archived`) бэкендом пока не
 * эмитируются, но объявлены в `connection-info.serverEvents`, и мы их
 * предусмотрительно поддерживаем — при появлении на сервере UI «зажжётся»
 * без дополнительной правки.
 */
export type NotificationWsEvent =
  | { type: "notification.created"; payload: Record<string, unknown> }
  | { type: "notification.read"; payload: { id?: string } }
  | { type: "notification.all_read"; payload: { workspace_id?: string } }
  | { type: "notification.archived"; payload: { id?: string } }
  | { type: string; payload: unknown };

export interface LoginPayload {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
}

export interface UserPayload {
  id: string;
  email: string;
  status: string;
  isEmailConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Расширенный профиль текущего пользователя из Profile BC
 * (`GET /profile/me`). В отличие от `UserPayload` (Identity BC), содержит
 * пользовательские поля — аватар, биографию и должность.
 */
export interface ProfilePayload {
  id: string;
  userId: string;
  avatarUrl?: string;
  bio?: string;
  jobTitle?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Активная сессия пользователя из Identity BC (`GET /account/sessions`).
 * Используется на странице Settings → Security для списка устройств и
 * операции «выйти везде» / «завершить сессию».
 */
export interface SessionPayload {
  id: string;
  userId: string;
  deviceInfo: string;
  ipAddress: string;
  status: string;
  isRememberMe: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface WorkspaceMemberPayload {
  id: string;
  userId: string;
  displayName?: string;
  roleId: string;
  joinedAt: string;
  isActive: boolean;
  source: string;
  invitedBy?: string;
}

// ── Project members / roles / invitations ──────────────────────

export interface ProjectMemberPayload {
  id: string;
  userId: string;
  roleId: string;
  joinedAt?: string;
  isActive: boolean;
}

export interface ProjectRolePayload {
  id: string;
  projectId: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
  description?: string;
}

export interface ProjectInvitationLinkPayload {
  value: string;
  expiresAt?: string;
  maxUses?: number;
  usedCount: number;
}

export interface ProjectInvitationPayload {
  id: string;
  projectId: string;
  workspaceId: string;
  email?: string;
  link?: ProjectInvitationLinkPayload;
  roleId: string;
  invitedBy: string;
  invitedAt: string;
  status: "pending" | "accepted" | "declined" | "expired" | "revoked";
  userId?: string;
  projectName?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Backend DTO → UI mapper helpers ────────────────────────────

interface BackendWorkspace {
  id: string;
  name: string;
  status: string;
  workspace_type: string;
  organization_id?: string | null;
  parent_workspace_id?: string | null;
  owner_ids?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function mapWorkspace(bw: BackendWorkspace): WorkspacePayload {
  return {
    id: bw.id,
    name: bw.name,
    slug: bw.name.toLowerCase().replace(/\s+/g, "-"),
  };
}

interface BackendProject {
  id: string;
  workspace_id: string;
  name: string;
  description?: { content: string; format: string } | null;
  methodology: string;
  visibility: string;
  status: string;
  color?: string | null;
  icon?: string | null;
  category?: string | null;
  owner_ids?: string[] | null;
  start_date?: string | null;
  deadline?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function mapProject(bp: BackendProject): ProjectPayload {
  return {
    id: bp.id,
    workspaceId: bp.workspace_id,
    name: bp.name,
    description: bp.description?.content ?? undefined,
    color: bp.color ?? undefined,
    icon: bp.icon ?? undefined,
    status: bp.status,
    methodology: bp.methodology,
    ownerIds: bp.owner_ids ?? [],
  };
}

interface BackendTask {
  id: string;
  project_id: string;
  parent_task_id?: string | null;
  epic_id?: string | null;
  title: string;
  description?: { content: string; format: string } | null;
  status: string;
  status_id?: string | null;
  column_id?: string | null;
  priority: string;
  task_type: string;
  assignee_ids?: string[];
  reporter_id?: string | null;
  labels?: { name: string; color?: string | null }[];
  progress: number;
  due_date?: string | null;
  start_date?: string | null;
  completed_at?: string | null;
  sprint_id?: string | null;
  custom_fields?: Record<string, string>;
  checklists?: BackendChecklist[];
  relations?: BackendTaskRelation[];
  watchers?: BackendTaskWatcher[];
  attachments?: BackendTaskAttachment[];
  created_at: string;
  updated_at: string;
}

interface BackendChecklistItem {
  id: string;
  text: string;
  is_checked: boolean;
  assignee_id?: string | null;
  due_date?: string | null;
  checked_at?: string | null;
  order: number;
}

interface BackendChecklist {
  id: string;
  title: string;
  items?: BackendChecklistItem[];
}

interface BackendTaskRelation {
  related_task_id: string;
  relation_type: string;
  created_at: string;
  created_by: string;
}

interface BackendTaskAttachment {
  file_id: string;
  filename: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: string;
}

interface BackendTaskWatcher {
  user_id: string;
  watched_at: string;
}

function mapTask(bt: BackendTask): TaskPayload {
  return {
    id: bt.id,
    title: bt.title,
    status: bt.status,
    statusId: bt.status_id ?? undefined,
    columnId: bt.column_id ?? undefined,
    priority: bt.priority,
    dueDate: bt.due_date ?? undefined,
    startDate: bt.start_date ?? undefined,
    labels: bt.labels?.map((l) => l.name) ?? [],
    projectId: bt.project_id,
    taskType: bt.task_type,
    assigneeIds: bt.assignee_ids ?? [],
    reporterId: bt.reporter_id ?? undefined,
    progress: bt.progress,
    sprintId: bt.sprint_id ?? undefined,
    epicId: bt.epic_id ?? undefined,
    parentTaskId: bt.parent_task_id ?? undefined,
    createdAt: bt.created_at,
    completedAt: bt.completed_at ?? undefined,
  };
}

function mapChecklistItem(it: BackendChecklistItem): ChecklistItemPayload {
  return {
    id: it.id,
    text: it.text,
    isChecked: it.is_checked,
    assigneeId: it.assignee_id ?? undefined,
    dueDate: it.due_date ?? undefined,
    checkedAt: it.checked_at ?? undefined,
    order: it.order,
  };
}

function mapChecklist(c: BackendChecklist): ChecklistPayload {
  return { id: c.id, title: c.title, items: (c.items ?? []).map(mapChecklistItem) };
}

function mapTaskDetail(bt: BackendTask): TaskDetailPayload {
  return {
    ...mapTask(bt),
    description: bt.description?.content,
    descriptionFormat: bt.description?.format,
    checklists: (bt.checklists ?? []).map(mapChecklist),
    relations: (bt.relations ?? []).map((r) => ({
      relatedTaskId: r.related_task_id,
      relationType: r.relation_type,
      createdAt: r.created_at,
      createdBy: r.created_by,
    })),
    watchers: (bt.watchers ?? []).map((w) => ({
      userId: w.user_id,
      watchedAt: w.watched_at,
    })),
    attachments: (bt.attachments ?? []).map((a) => ({
      fileId: a.file_id,
      filename: a.filename,
      sizeBytes: a.size_bytes,
      uploadedBy: a.uploaded_by,
      uploadedAt: a.uploaded_at,
    })),
    customFields: bt.custom_fields ?? {},
  };
}

interface BackendSprint {
  id: string;
  project_id: string;
  name: string;
  goal?: string | null;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
}

function mapSprint(bs: BackendSprint): SprintPayload {
  return {
    id: bs.id,
    projectId: bs.project_id,
    name: bs.name,
    goal: bs.goal ?? undefined,
    status: bs.status,
    startDate: bs.start_date ?? undefined,
    endDate: bs.end_date ?? undefined,
    createdAt: bs.created_at ?? undefined,
  };
}

interface BackendEpic {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  status: string;
  color?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

function mapEpic(be: BackendEpic): EpicPayload {
  return {
    id: be.id,
    projectId: be.project_id,
    name: be.name,
    description: be.description ?? undefined,
    status: be.status,
    color: be.color ?? undefined,
    startDate: be.start_date ?? undefined,
    endDate: be.end_date ?? undefined,
  };
}

interface BackendBoardColumn {
  id: string;
  name: string;
  status_mapping: string | null;
  order: number;
  color?: string | null;
  wip_limit?: number | null;
}

interface BackendWorkflowStatus {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  order: number;
  is_default: boolean;
  category: string;
}

function mapBoardColumn(c: BackendBoardColumn): BoardColumnPayload {
  return {
    id: c.id,
    name: c.name,
    statusMapping: c.status_mapping,
    position: c.order,
    wipLimit: c.wip_limit ?? null,
  };
}

function mapWorkflowStatus(s: BackendWorkflowStatus): WorkflowStatusPayload {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    order: s.order,
    isDefault: s.is_default,
  };
}

interface BackendComment {
  id: string;
  target_type: string;
  target_id: string;
  author_id: string;
  content: string;
  content_format: string;
  parent_comment_id?: string | null;
  attachments?: BackendCommentAttachment[];
  created_at: string;
  updated_at?: string | null;
  is_pinned: boolean;
}

interface BackendCommentAttachment {
  id: string;
  file_id: string;
  url?: string | null;
  attachment_type?: string | null;
  name?: string | null;
  size_bytes?: number | null;
  preview_url?: string | null;
  created_at?: string | null;
}

function mapComment(c: BackendComment): CommentPayload {
  return {
    id: c.id,
    targetType: c.target_type,
    targetId: c.target_id,
    authorId: c.author_id,
    content: c.content,
    contentFormat: c.content_format,
    parentCommentId: c.parent_comment_id ?? undefined,
    attachments: (c.attachments ?? []).map((a) => ({
      id: a.id,
      fileId: a.file_id,
      url: a.url ?? undefined,
      attachmentType: a.attachment_type ?? undefined,
      name: a.name ?? undefined,
      sizeBytes: a.size_bytes ?? undefined,
      previewUrl: a.preview_url ?? undefined,
      createdAt: a.created_at ?? undefined,
    })),
    createdAt: c.created_at,
    updatedAt: c.updated_at ?? undefined,
    isPinned: c.is_pinned,
  };
}

// ── Communication BC DTO + mappers ────────────────────────────

interface BackendChatMember {
  user_id: string;
  role: string;
  joined_at?: string | null;
  last_read_at?: string | null;
}

interface BackendChat {
  id: string;
  chat_type: string;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  workspace_id?: string | null;
  project_id?: string | null;
  members?: BackendChatMember[];
  is_archived: boolean;
  last_message_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function mapChat(b: BackendChat): ChatPayload {
  return {
    id: b.id,
    chatType: b.chat_type as ChatType,
    name: b.name ?? undefined,
    description: b.description ?? undefined,
    icon: b.icon ?? undefined,
    color: b.color ?? undefined,
    workspaceId: b.workspace_id ?? undefined,
    projectId: b.project_id ?? undefined,
    members: (b.members ?? []).map((m) => ({
      userId: m.user_id,
      role: m.role,
      joinedAt: m.joined_at ?? undefined,
      lastReadAt: m.last_read_at ?? undefined,
    })),
    isArchived: b.is_archived,
    lastMessageAt: b.last_message_at ?? undefined,
    createdAt: b.created_at ?? undefined,
    updatedAt: b.updated_at ?? undefined,
  };
}

interface BackendMessageReaction {
  emoji: string;
  user_ids: string[];
}

/**
 * Подсказка типа из backend-поля `attachment_type` (`image|video|file|...`).
 * Используется как запасной mime, если backend не присылает реальный
 * `mime_type` — потребитель в чате благодаря этому не валит фото в `other`.
 */
function attachmentTypeToMime(t?: string | null): string | undefined {
  if (!t) return undefined;
  const v = t.toLowerCase();
  if (v === "image") return "image/*";
  if (v === "video") return "video/*";
  if (v === "voice") return "audio/*";
  return undefined;
}

interface BackendMessageAttachment {
  id: string;
  file_id: string;
  /**
   * Имя файла. Backend (`AttachmentResponse`) сериализует поле как `name`;
   * `filename` оставлен для обратной совместимости со старыми клиентами.
   */
  name?: string | null;
  filename?: string | null;
  attachment_type?: string | null;
  url?: string | null;
  size_bytes?: number | null;
  /**
   * Backend на текущий момент `mime_type` для message-attachments не отдаёт
   * (там только `attachment_type`: `image|video|file|...`). Тип определяем
   * на фронте по имени файла + `attachment_type`.
   */
  mime_type?: string | null;
  preview_url?: string | null;
}

interface BackendMessage {
  id: string;
  chat_id: string;
  thread_id?: string | null;
  sender_id: string;
  content?: string | null;
  content_format: string;
  message_type: string;
  reply_to_id?: string | null;
  attachments?: BackendMessageAttachment[];
  reactions?: BackendMessageReaction[];
  is_edited: boolean;
  is_deleted: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

function mapMessage(b: BackendMessage): MessagePayload {
  return {
    id: b.id,
    chatId: b.chat_id,
    threadId: b.thread_id ?? undefined,
    senderId: b.sender_id,
    content: b.content ?? undefined,
    contentFormat: b.content_format,
    messageType: b.message_type,
    replyToId: b.reply_to_id ?? undefined,
    attachments: (b.attachments ?? []).map((a) => ({
      id: a.id,
      fileId: a.file_id,
      // Backend сериализует имя файла как `name`. Поле `filename` оставлено
      // как fallback на случай, если кто-то ещё клиентов так шлёт.
      filename: a.name ?? a.filename ?? "",
      sizeBytes: a.size_bytes ?? undefined,
      // mime_type backend пока не отдаёт — kind определяется по расширению
      // имени файла в потребителе. attachment_type ('image'|'video'|...)
      // дополнительно поможет при отсутствии расширения.
      mimeType: a.mime_type ?? attachmentTypeToMime(a.attachment_type),
    })),
    reactions: (b.reactions ?? []).map((r) => ({
      emoji: r.emoji,
      userIds: r.user_ids,
    })),
    isEdited: b.is_edited,
    isDeleted: b.is_deleted,
    createdAt: b.created_at ?? undefined,
    updatedAt: b.updated_at ?? undefined,
  };
}

interface BackendMeetingParticipant {
  user_id: string;
  is_mandatory: boolean;
  rsvp_status: string;
  joined_at?: string | null;
}

interface BackendMeeting {
  id: string;
  title: string;
  description?: string | null;
  description_format?: string;
  meeting_type: string;
  status: string;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  location?: string | null;
  conference_provider: string;
  conference_url?: string | null;
  workspace_id: string;
  project_id?: string | null;
  organizer_id: string;
  participants?: BackendMeetingParticipant[];
  agenda?: string[];
  created_at?: string | null;
  updated_at?: string | null;
}

function mapMeeting(b: BackendMeeting): MeetingPayload {
  return {
    id: b.id,
    title: b.title,
    description: b.description ?? undefined,
    meetingType: b.meeting_type,
    status: b.status,
    scheduledAt: b.scheduled_at ?? undefined,
    durationMinutes: b.duration_minutes ?? undefined,
    location: b.location ?? undefined,
    conferenceUrl: b.conference_url ?? undefined,
    conferenceProvider: b.conference_provider,
    workspaceId: b.workspace_id,
    projectId: b.project_id ?? undefined,
    organizerId: b.organizer_id,
    participants: (b.participants ?? []).map((p) => ({
      userId: p.user_id,
      isMandatory: p.is_mandatory,
      rsvpStatus: p.rsvp_status,
      joinedAt: p.joined_at ?? undefined,
    })),
    agenda: b.agenda ?? [],
    createdAt: b.created_at ?? undefined,
    updatedAt: b.updated_at ?? undefined,
  };
}

// ── FileStorage BC DTO + mappers ──────────────────────────────

interface BackendFolder {
  id: string;
  name: string;
  folder_type: string;
  parent_folder_id?: string | null;
  color?: string | null;
  description?: string | null;
  icon?: string | null;
  owner_id: string;
  workspace_id: string;
  project_id?: string | null;
  is_pinned?: boolean;
  is_shared?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

function mapFolder(b: BackendFolder): FolderPayload {
  return {
    id: b.id,
    name: b.name,
    folderType: b.folder_type,
    parentFolderId: b.parent_folder_id ?? undefined,
    color: b.color ?? undefined,
    description: b.description ?? undefined,
    icon: b.icon ?? undefined,
    ownerId: b.owner_id,
    workspaceId: b.workspace_id,
    projectId: b.project_id ?? undefined,
    isPinned: b.is_pinned ?? false,
    isShared: b.is_shared ?? false,
    createdAt: b.created_at ?? undefined,
    updatedAt: b.updated_at ?? undefined,
  };
}

interface BackendFileTag {
  id: string;
  name: string;
  color?: string | null;
}

interface BackendShareLink {
  id: string;
  token: string;
  has_password: boolean;
  expires_at?: string | null;
  access_level: string;
  allow_download: boolean;
  max_uses?: number | null;
  current_uses: number;
  created_by: string;
  created_at?: string | null;
}

interface BackendFile {
  id: string;
  name: string;
  original_name: string;
  file_type: string;
  size_bytes: number;
  mime_type: string;
  storage_id: string;
  folder_id?: string | null;
  uploader_id: string;
  workspace_id: string;
  owner_id: string;
  description?: string | null;
  status: string;
  scan_status: string;
  is_shared?: boolean;
  lock?: unknown | null;
  tags?: BackendFileTag[];
  share_links?: BackendShareLink[];
  preview_path?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function mapFile(b: BackendFile): FilePayload {
  return {
    id: b.id,
    name: b.name,
    originalName: b.original_name,
    fileType: b.file_type,
    sizeBytes: b.size_bytes,
    mimeType: b.mime_type,
    storageId: b.storage_id,
    folderId: b.folder_id ?? undefined,
    uploaderId: b.uploader_id,
    workspaceId: b.workspace_id,
    ownerId: b.owner_id,
    description: b.description ?? undefined,
    status: b.status,
    scanStatus: b.scan_status,
    isShared: b.is_shared ?? false,
    isLocked: b.lock != null,
    tags: (b.tags ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color ?? undefined,
    })),
    shareLinks: (b.share_links ?? []).map((s) => ({
      id: s.id,
      token: s.token,
      hasPassword: s.has_password,
      expiresAt: s.expires_at ?? undefined,
      accessLevel: s.access_level,
      allowDownload: s.allow_download,
      maxUses: s.max_uses ?? undefined,
      currentUses: s.current_uses,
      createdBy: s.created_by,
      createdAt: s.created_at ?? undefined,
    })),
    previewPath: b.preview_path ?? undefined,
    createdAt: b.created_at ?? undefined,
    updatedAt: b.updated_at ?? undefined,
  };
}

interface BackendWorkspaceMember {
  id: string;
  user_id: string;
  display_name?: string | null;
  role_id: string;
  joined_at: string;
  is_active: boolean;
  source: string;
  invited_by?: string | null;
}

function mapWorkspaceMember(bm: BackendWorkspaceMember): WorkspaceMemberPayload {
  return {
    id: bm.id,
    userId: bm.user_id,
    displayName: bm.display_name ?? undefined,
    roleId: bm.role_id,
    joinedAt: bm.joined_at,
    isActive: bm.is_active,
    source: bm.source,
    invitedBy: bm.invited_by ?? undefined,
  };
}

// ── Project members/roles/invitations: backend DTO mapping ──────

interface BackendProjectMember {
  id: string;
  user_id: string;
  role_id: string;
  joined_at?: string | null;
  is_active: boolean;
}

function mapProjectMember(bm: BackendProjectMember): ProjectMemberPayload {
  return {
    id: bm.id,
    userId: bm.user_id,
    roleId: bm.role_id,
    joinedAt: bm.joined_at ?? undefined,
    isActive: bm.is_active,
  };
}

interface BackendProjectRole {
  id: string;
  project_id: string;
  name: string;
  permissions: string[];
  is_system: boolean;
  description?: string | null;
}

function mapProjectRole(br: BackendProjectRole): ProjectRolePayload {
  return {
    id: br.id,
    projectId: br.project_id,
    name: br.name,
    permissions: br.permissions ?? [],
    isSystem: br.is_system,
    description: br.description ?? undefined,
  };
}

interface BackendProjectInvitationLink {
  value: string;
  expires_at?: string | null;
  max_uses?: number | null;
  used_count: number;
}

interface BackendProjectInvitation {
  id: string;
  project_id: string;
  workspace_id: string;
  email?: string | null;
  link?: BackendProjectInvitationLink | null;
  role_id: string;
  invited_by: string;
  invited_at: string;
  status: string;
  user_id?: string | null;
  project_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function mapProjectInvitation(bi: BackendProjectInvitation): ProjectInvitationPayload {
  return {
    id: bi.id,
    projectId: bi.project_id,
    workspaceId: bi.workspace_id,
    email: bi.email ?? undefined,
    link: bi.link
      ? {
          value: bi.link.value,
          expiresAt: bi.link.expires_at ?? undefined,
          maxUses: bi.link.max_uses ?? undefined,
          usedCount: bi.link.used_count ?? 0,
        }
      : undefined,
    roleId: bi.role_id,
    invitedBy: bi.invited_by,
    invitedAt: bi.invited_at,
    status: (bi.status as ProjectInvitationPayload["status"]) ?? "pending",
    userId: bi.user_id ?? undefined,
    projectName: bi.project_name ?? undefined,
    createdAt: bi.created_at ?? undefined,
    updatedAt: bi.updated_at ?? undefined,
  };
}

// ── Analytics ───────────────────────────────────────────────────

/**
 * Серверные value-objects, передаваемые как строковые enum'ы.
 * Зеркалируются из `app/context/analytics/domain/value_objects/`.
 * Реальный список приходит из `GET /analytics/schema`, но базовые
 * значения важно зафиксировать, чтобы фронт мог собирать запросы
 * вручную без рантайм-проверок.
 */
export type AnalyticsDataSource =
  | "task"
  | "task_status_change"
  | "task_assignment"
  | "project"
  | "project_member"
  | "sprint"
  | "epic"
  | "workspace"
  | "workspace_member"
  | "timetracking_entry";

export type AnalyticsAggregation =
  | "count"
  | "count_distinct"
  | "sum"
  | "avg"
  | "min"
  | "max";

export type AnalyticsFilterOperator =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "contains"
  | "starts_with"
  | "is_null"
  | "is_not_null";

export type AnalyticsSortOrder = "asc" | "desc";

export type AnalyticsTimeGranularity =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";

export type WidgetType =
  | "kpi"
  | "table"
  | "line_chart"
  | "bar_chart"
  | "pie_chart"
  | "area_chart"
  | "funnel"
  | "stacked_bar"
  | "scorecard";

export interface AnalyticsMetricDefinition {
  field: string;
  aggregation: AnalyticsAggregation;
  alias?: string;
}

export interface AnalyticsDimension {
  field: string;
  timeGranularity?: AnalyticsTimeGranularity;
  alias?: string;
}

export interface AnalyticsFilter {
  field: string;
  operator: AnalyticsFilterOperator;
  value: string;
  valueTo?: string;
}

export interface AnalyticsSortRule {
  field: string;
  order: AnalyticsSortOrder;
}

export interface AnalyticsDateRange {
  start?: string;
  end?: string;
}

export interface AnalyticsQuery {
  dataSource: AnalyticsDataSource | string;
  metrics: AnalyticsMetricDefinition[];
  dimensions: AnalyticsDimension[];
  filters: AnalyticsFilter[];
  dateRange?: AnalyticsDateRange;
  sort: AnalyticsSortRule[];
  limit?: number;
  raw: boolean;
}

export interface AnalyticsResultRow {
  values: Record<string, unknown>;
}

export interface AnalyticsResult {
  dataSource: string;
  boundedContext: string;
  columns: string[];
  rows: AnalyticsResultRow[];
  total: number;
  generatedAt: string;
}

export interface AnalyticsWidget {
  id: string;
  title: string;
  widgetType: WidgetType | string;
  order: number;
  size: { w: number; h: number };
  position?: { x: number; y: number };
  query?: AnalyticsQuery;
  displayParams: Record<string, unknown>;
}

export interface DashboardShare {
  userId: string;
  accessLevel: string;
  sharedAt: string;
}

export interface DashboardPayload {
  id: string;
  ownerId: string;
  workspaceId?: string;
  name: string;
  description?: string;
  widgets: AnalyticsWidget[];
  shares: DashboardShare[];
  isAutoRefresh: boolean;
  refreshIntervalSeconds?: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardTemplatePayload {
  id: string;
  workspaceId?: string;
  name: string;
  description?: string;
  widgets: AnalyticsWidget[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsFieldDescriptor {
  name: string;
  type: string;
  description: string;
  filterable: boolean;
  groupable: boolean;
  sortable: boolean;
  timeGranularitySupported: boolean;
  allowedValues?: string[];
  notes?: string;
}

export interface AnalyticsDataSourceSchema {
  dataSource: string;
  boundedContext: string;
  description?: string;
  fields: AnalyticsFieldDescriptor[];
  supportedAggregations: string[];
  defaultMetrics: Array<{ field: string; aggregation: string; alias?: string }>;
  notes?: string;
}

export interface AnalyticsSchemaPayload {
  dataSources: AnalyticsDataSourceSchema[];
  filterOperators: string[];
  aggregations: string[];
  timeGranularities: string[];
  sortOrders: string[];
  widgetTypes: string[];
}

// ── Analytics mapping (backend snake_case → frontend camelCase) ──

interface BackendAnalyticsQuery {
  data_source: string;
  metrics?: Array<{ field?: string; aggregation?: string; alias?: string | null }>;
  dimensions?: Array<{
    field: string;
    time_granularity?: string | null;
    alias?: string | null;
  }>;
  filters?: Array<{
    field: string;
    operator: string;
    value: string;
    value_to?: string | null;
  }>;
  date_range?: { start?: string | null; end?: string | null } | null;
  sort?: Array<{ field: string; order?: string }>;
  limit?: number | null;
  raw?: boolean;
}

interface BackendAnalyticsWidget {
  id: string;
  title: string;
  widget_type: string;
  order: number;
  size: { w?: number; h?: number; [k: string]: number | undefined };
  position?: { x?: number; y?: number; [k: string]: number | undefined } | null;
  query?: BackendAnalyticsQuery | null;
  display_params?: Record<string, unknown>;
}

interface BackendDashboard {
  id: string;
  owner_id: string;
  workspace_id?: string | null;
  name: string;
  description?: string | null;
  widgets?: BackendAnalyticsWidget[];
  shares?: Array<{ user_id: string; access_level: string; shared_at: string }>;
  is_auto_refresh?: boolean;
  refresh_interval_seconds?: number | null;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
}

interface BackendDashboardTemplate {
  id: string;
  workspace_id?: string | null;
  name: string;
  description?: string | null;
  widgets?: BackendAnalyticsWidget[];
  is_system?: boolean;
  created_at: string;
  updated_at: string;
}

interface BackendAnalyticsResult {
  data_source: string;
  bounded_context: string;
  columns?: string[];
  rows?: Array<{ values?: Record<string, unknown> }>;
  total?: number;
  generated_at?: string;
}

function mapAnalyticsQuery(bq: BackendAnalyticsQuery): AnalyticsQuery {
  return {
    dataSource: bq.data_source,
    metrics: (bq.metrics ?? []).map((m) => ({
      field: m.field ?? "*",
      aggregation: (m.aggregation ?? "count") as AnalyticsAggregation,
      alias: m.alias ?? undefined,
    })),
    dimensions: (bq.dimensions ?? []).map((d) => ({
      field: d.field,
      timeGranularity: (d.time_granularity ?? undefined) as AnalyticsTimeGranularity | undefined,
      alias: d.alias ?? undefined,
    })),
    filters: (bq.filters ?? []).map((f) => ({
      field: f.field,
      operator: f.operator as AnalyticsFilterOperator,
      value: f.value,
      valueTo: f.value_to ?? undefined,
    })),
    dateRange: bq.date_range
      ? { start: bq.date_range.start ?? undefined, end: bq.date_range.end ?? undefined }
      : undefined,
    sort: (bq.sort ?? []).map((s) => ({
      field: s.field,
      order: (s.order ?? "desc") as AnalyticsSortOrder,
    })),
    limit: bq.limit ?? undefined,
    raw: bq.raw ?? false,
  };
}

function mapAnalyticsWidget(bw: BackendAnalyticsWidget): AnalyticsWidget {
  return {
    id: bw.id,
    title: bw.title,
    widgetType: bw.widget_type,
    order: bw.order,
    size: { w: bw.size?.w ?? 1, h: bw.size?.h ?? 1 },
    position: bw.position
      ? { x: bw.position.x ?? 0, y: bw.position.y ?? 0 }
      : undefined,
    query: bw.query ? mapAnalyticsQuery(bw.query) : undefined,
    displayParams: bw.display_params ?? {},
  };
}

function mapDashboard(bd: BackendDashboard): DashboardPayload {
  return {
    id: bd.id,
    ownerId: bd.owner_id,
    workspaceId: bd.workspace_id ?? undefined,
    name: bd.name,
    description: bd.description ?? undefined,
    widgets: (bd.widgets ?? []).map(mapAnalyticsWidget),
    shares: (bd.shares ?? []).map((s) => ({
      userId: s.user_id,
      accessLevel: s.access_level,
      sharedAt: s.shared_at,
    })),
    isAutoRefresh: bd.is_auto_refresh ?? false,
    refreshIntervalSeconds: bd.refresh_interval_seconds ?? undefined,
    isDefault: bd.is_default ?? false,
    createdAt: bd.created_at,
    updatedAt: bd.updated_at,
  };
}

function mapDashboardTemplate(bt: BackendDashboardTemplate): DashboardTemplatePayload {
  return {
    id: bt.id,
    workspaceId: bt.workspace_id ?? undefined,
    name: bt.name,
    description: bt.description ?? undefined,
    widgets: (bt.widgets ?? []).map(mapAnalyticsWidget),
    isSystem: bt.is_system ?? false,
    createdAt: bt.created_at,
    updatedAt: bt.updated_at,
  };
}

function mapAnalyticsResult(br: BackendAnalyticsResult): AnalyticsResult {
  return {
    dataSource: br.data_source,
    boundedContext: br.bounded_context,
    columns: br.columns ?? [],
    rows: (br.rows ?? []).map((r) => ({ values: r.values ?? {} })),
    total: br.total ?? 0,
    generatedAt: br.generated_at ?? "",
  };
}

/**
 * Конвертирует frontend-`AnalyticsQuery` обратно в snake_case-форму,
 * которую ждёт бэкенд (`AnalyticsQueryRequest`).
 */
function analyticsQueryToRequest(q: AnalyticsQuery): Record<string, unknown> {
  return {
    data_source: q.dataSource,
    metrics: q.metrics.map((m) => ({
      field: m.field,
      aggregation: m.aggregation,
      ...(m.alias ? { alias: m.alias } : {}),
    })),
    dimensions: q.dimensions.map((d) => ({
      field: d.field,
      ...(d.timeGranularity ? { time_granularity: d.timeGranularity } : {}),
      ...(d.alias ? { alias: d.alias } : {}),
    })),
    filters: q.filters.map((f) => ({
      field: f.field,
      operator: f.operator,
      value: f.value,
      ...(f.valueTo != null ? { value_to: f.valueTo } : {}),
    })),
    ...(q.dateRange
      ? {
          date_range: {
            ...(q.dateRange.start ? { start: q.dateRange.start } : {}),
            ...(q.dateRange.end ? { end: q.dateRange.end } : {}),
          },
        }
      : {}),
    sort: q.sort.map((s) => ({ field: s.field, order: s.order })),
    ...(q.limit != null ? { limit: q.limit } : {}),
    raw: q.raw,
  };
}

// ── API methods ────────────────────────────────────────────────

export const api = {
  // ── Auth (через Next BFF, токены в httpOnly-cookies) ─────────
  login: async (
    email: string,
    password: string,
    isRememberMe = false,
  ): Promise<LoginPayload> => {
    const { user } = await authLogin({ email, password, isRememberMe });
    return {
      // accessToken остаётся в форме результата для совместимости с UI,
      // но он недоступен JS — настоящий токен живёт в httpOnly cookie.
      accessToken: "",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.email.split("@")[0] ?? "",
      },
    };
  },

  register: async (
    email: string,
    password: string,
  ): Promise<UserPayload> => {
    const { user } = await authRegister({ email, password });
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      isEmailConfirmed: user.isEmailConfirmed,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  },

  getMe: async (): Promise<UserPayload> => {
    const user = await authMe();
    if (!user) {
      throw new ApiError(401, "UNAUTHENTICATED", "Не аутентифицирован");
    }
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      isEmailConfirmed: user.isEmailConfirmed,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  },

  logout: async (): Promise<void> => {
    await authLogout();
  },

  // ── Profile (Profile BC) ─────────────────────────────────────
  /**
   * Получить расширенный профиль текущего пользователя.
   * Бэкенд: `GET /profile/me` → ProfileResponse.
   */
  getMyProfile: async (): Promise<ProfilePayload> => {
    type BackendProfile = {
      id: string;
      user_id: string;
      avatar_url?: string | null;
      bio?: string | null;
      job_title?: string | null;
      created_at: string;
      updated_at: string;
    };
    const res = await apiGet<BackendProfile>("/profile/me");
    return {
      id: res.data.id,
      userId: res.data.user_id,
      avatarUrl: res.data.avatar_url ?? undefined,
      bio: res.data.bio ?? undefined,
      jobTitle: res.data.job_title ?? undefined,
      createdAt: res.data.created_at,
      updatedAt: res.data.updated_at,
    };
  },

  /**
   * Обновить персональные поля профиля. Поля передаются опционально;
   * `null` на бэкенде НЕ изменяет значение, поэтому пустую строку мы
   * шлём как пустую строку, а отсутствие — как undefined (не отправится).
   * Бэкенд: `PATCH /profile/me/personal-info`.
   */
  updatePersonalInfo: async (payload: {
    bio?: string;
    jobTitle?: string;
  }): Promise<void> => {
    const body: Record<string, unknown> = {};
    if (payload.bio !== undefined) body.bio = payload.bio;
    if (payload.jobTitle !== undefined) body.job_title = payload.jobTitle;
    await apiPatch("/profile/me/personal-info", body);
  },

  // ── Account (Identity BC) ────────────────────────────────────
  /**
   * Получить базовые данные пользователя (id, email, status) по UUID.
   * Используется для отображения email коллег вместо «голого» UUID
   * в задачах, комментариях, истории. Бэкенд: `GET /account/users/{id}`.
   */
  getUserById: async (userId: string): Promise<UserPayload> => {
    type BackendUser = {
      id: string;
      email: string;
      status: string;
      is_email_confirmed: boolean;
      created_at: string;
      updated_at: string;
    };
    const res = await apiGet<BackendUser>(`/account/users/${userId}`);
    return {
      id: res.data.id,
      email: res.data.email,
      status: res.data.status,
      isEmailConfirmed: res.data.is_email_confirmed,
      createdAt: res.data.created_at,
      updatedAt: res.data.updated_at,
    };
  },

  /**
   * Сменить пароль текущего пользователя.
   * Бэкенд: `POST /account/me/change-password`.
   */
  changePassword: async (payload: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> => {
    await apiPost("/account/me/change-password", {
      current_password: payload.currentPassword,
      new_password: payload.newPassword,
    });
  },

  /**
   * Список активных сессий текущего пользователя.
   * Бэкенд: `GET /account/sessions`.
   */
  getActiveSessions: async (): Promise<SessionPayload[]> => {
    type BackendSession = {
      id: string;
      user_id: string;
      device_info: string;
      ip_address: string;
      status: string;
      is_remember_me: boolean;
      created_at: string;
      expires_at: string;
    };
    const res = await apiGet<BackendSession[]>("/account/sessions");
    return (res.data ?? []).map((s) => ({
      id: s.id,
      userId: s.user_id,
      deviceInfo: s.device_info,
      ipAddress: s.ip_address,
      status: s.status,
      isRememberMe: s.is_remember_me,
      createdAt: s.created_at,
      expiresAt: s.expires_at,
    }));
  },

  /**
   * Завершить указанную сессию пользователя.
   * Бэкенд: `DELETE /account/sessions/{session_id}`.
   */
  terminateSession: async (sessionId: string): Promise<void> => {
    await apiDelete(`/account/sessions/${sessionId}`);
  },

  // ── Workspaces ───────────────────────────────────────────────
  getWorkspaces: async (): Promise<WorkspacePayload[]> => {
    const res = await apiGetPaginated<BackendWorkspace>("/workspaces/");
    return (res.items ?? []).map(mapWorkspace);
  },

  createWorkspace: async (
    name: string,
    type = "PERSONAL",
  ): Promise<WorkspacePayload> => {
    const res = await apiPost<BackendWorkspace>("/workspaces/", {
      name,
      workspace_type: type,
    });
    return mapWorkspace(res.data);
  },

  getWorkspaceMembers: async (
    workspaceId: string,
  ): Promise<WorkspaceMemberPayload[]> => {
    const res = await apiGetPaginated<BackendWorkspaceMember>(
      `/workspaces/${workspaceId}/members`,
      { limit: "100" },
    );
    return (res.items ?? []).map(mapWorkspaceMember);
  },

  /**
   * Обновить информацию workspace (имя/цвет/иконка/описание).
   * Бэкенд: `PATCH /workspaces/{ws_id}`. Поля передаются опционально.
   */
  updateWorkspaceInfo: async (
    workspaceId: string,
    payload: {
      name?: string;
      color?: string;
      icon?: string;
      displayName?: string;
      description?: string;
    },
  ): Promise<void> => {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.color !== undefined) body.color = payload.color;
    if (payload.icon !== undefined) body.icon = payload.icon;
    if (payload.displayName !== undefined) body.display_name = payload.displayName;
    if (payload.description !== undefined) body.description = payload.description;
    await apiPatch(`/workspaces/${workspaceId}`, body);
  },

  // ── Projects ────────────────────────────────────────────────
  getProjects: async (workspaceId: string): Promise<ProjectPayload[]> => {
    const res = await apiGet<BackendProject[]>(
      `/workspaces/${workspaceId}/projects/`,
    );
    return (res.data ?? []).map(mapProject);
  },

  /**
   * Все проекты текущего пользователя — поверх workspace'ов. Backend:
   * `GET /projects/mine`. Возвращает проекты, в которых пользователь является
   * участником (по project-membership), включая те, в которые он попал через
   * принятие приглашения (роль GUEST в проекте чужого workspace'а).
   *
   * Используется для:
   *   - Списка проектов в сайдбаре (cross-workspace).
   *   - Поиска проекта по id на странице доски (без знания workspaceId).
   *   - 404 для не-членов: если проекта нет в списке — у пользователя нет
   *     доступа.
   */
  getMyProjects: async (): Promise<ProjectPayload[]> => {
    const res = await apiGet<BackendProject[]>("/projects/mine");
    return (res.data ?? []).map(mapProject);
  },

  createProject: async (payload: {
    workspaceId: string;
    name: string;
    description?: string;
  }): Promise<ProjectPayload> => {
    const res = await apiPost<BackendProject>(
      `/workspaces/${payload.workspaceId}/projects/`,
      {
        name: payload.name,
        methodology: "kanban",
        visibility: "workspace",
      },
    );
    return mapProject(res.data);
  },

  /**
   * Обновление полей проекта (имя/описание/иконка/цвет/категория/даты).
   * Бэкенд PATCH `/workspaces/{ws}/projects/{id}` через `UpdateProjectInfoRequest`.
   * Поля передаются только когда заданы (partial update).
   */
  updateProjectInfo: async (
    workspaceId: string,
    projectId: string,
    payload: {
      name?: string;
      description?: { content: string; format?: "PLAIN" | "MARKDOWN" | "HTML" };
      icon?: string;
      color?: string;
      startDate?: string;
      deadline?: string;
    },
  ): Promise<void> => {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.description !== undefined) {
      // Backend RichTextFormat enum использует lowercase ("markdown" / "wysiwyg").
      // Фронт исторически шлёт uppercase ("MARKDOWN") — приводим к lowercase,
      // иначе на бэке падает `RichTextFormat("MARKDOWN")` с ValueError → 500.
      body.description = {
        content: payload.description.content,
        format: (payload.description.format ?? "MARKDOWN").toLowerCase(),
      };
    }
    if (payload.icon !== undefined) body.icon = payload.icon;
    if (payload.color !== undefined) body.color = payload.color;
    if (payload.startDate !== undefined) body.start_date = payload.startDate;
    if (payload.deadline !== undefined) body.deadline = payload.deadline;
    await apiPatch(`/workspaces/${workspaceId}/projects/${projectId}`, body);
  },

  archiveProject: async (workspaceId: string, projectId: string): Promise<void> => {
    await apiPost(`/workspaces/${workspaceId}/projects/${projectId}/archive`);
  },

  restoreProject: async (workspaceId: string, projectId: string): Promise<void> => {
    await apiPost(`/workspaces/${workspaceId}/projects/${projectId}/restore`);
  },

  requestProjectDeletion: async (workspaceId: string, projectId: string): Promise<void> => {
    await apiPost(`/workspaces/${workspaceId}/projects/${projectId}/request-deletion`);
  },

  // ── Project members ─────────────────────────────────────────
  getProjectMembers: async (
    workspaceId: string,
    projectId: string,
  ): Promise<ProjectMemberPayload[]> => {
    const res = await apiGet<BackendProjectMember[]>(
      `/workspaces/${workspaceId}/projects/${projectId}/members`,
    );
    return (res.data ?? []).map(mapProjectMember);
  },

  addProjectMember: async (
    workspaceId: string,
    projectId: string,
    payload: { userId: string; roleId: string; membershipType?: "STANDARD" | "GUEST" },
  ): Promise<void> => {
    await apiPost(`/workspaces/${workspaceId}/projects/${projectId}/members`, {
      user_id: payload.userId,
      role_id: payload.roleId,
      membership_type: payload.membershipType ?? "STANDARD",
    });
  },

  changeProjectMemberRole: async (
    workspaceId: string,
    projectId: string,
    userId: string,
    newRoleId: string,
  ): Promise<void> => {
    await apiPatch(
      `/workspaces/${workspaceId}/projects/${projectId}/members/${userId}/role`,
      { new_role_id: newRoleId },
    );
  },

  removeProjectMember: async (
    workspaceId: string,
    projectId: string,
    userId: string,
  ): Promise<void> => {
    await apiDelete(`/workspaces/${workspaceId}/projects/${projectId}/members/${userId}`);
  },

  deactivateProjectMember: async (
    workspaceId: string,
    projectId: string,
    userId: string,
  ): Promise<void> => {
    await apiPost(
      `/workspaces/${workspaceId}/projects/${projectId}/members/${userId}/deactivate`,
    );
  },

  reactivateProjectMember: async (
    workspaceId: string,
    projectId: string,
    userId: string,
  ): Promise<void> => {
    await apiPost(
      `/workspaces/${workspaceId}/projects/${projectId}/members/${userId}/reactivate`,
    );
  },

  // ── Project roles ───────────────────────────────────────────
  getProjectRoles: async (
    workspaceId: string,
    projectId: string,
  ): Promise<ProjectRolePayload[]> => {
    const res = await apiGet<BackendProjectRole[]>(
      `/workspaces/${workspaceId}/projects/${projectId}/roles`,
    );
    return (res.data ?? []).map(mapProjectRole);
  },

  createProjectRole: async (
    workspaceId: string,
    projectId: string,
    payload: { name: string; permissions: string[]; description?: string },
  ): Promise<ProjectRolePayload> => {
    const res = await apiPost<BackendProjectRole>(
      `/workspaces/${workspaceId}/projects/${projectId}/roles`,
      {
        name: payload.name,
        permissions: payload.permissions,
        description: payload.description,
      },
    );
    return mapProjectRole(res.data);
  },

  updateProjectRole: async (
    workspaceId: string,
    projectId: string,
    roleId: string,
    payload: { permissions?: string[]; description?: string },
  ): Promise<void> => {
    const body: Record<string, unknown> = {};
    if (payload.permissions !== undefined) body.permissions = payload.permissions;
    if (payload.description !== undefined) body.description = payload.description;
    await apiPatch(
      `/workspaces/${workspaceId}/projects/${projectId}/roles/${roleId}`,
      body,
    );
  },

  deleteProjectRole: async (
    workspaceId: string,
    projectId: string,
    roleId: string,
  ): Promise<void> => {
    await apiDelete(`/workspaces/${workspaceId}/projects/${projectId}/roles/${roleId}`);
  },

  // ── Project invitations ─────────────────────────────────────
  getProjectInvitations: async (
    workspaceId: string,
    projectId: string,
  ): Promise<ProjectInvitationPayload[]> => {
    const res = await apiGetPaginated<BackendProjectInvitation>(
      `/workspaces/${workspaceId}/projects/${projectId}/invitations`,
      { limit: "200" },
    );
    return (res.items ?? []).map(mapProjectInvitation);
  },

  sendProjectInvitationEmail: async (
    workspaceId: string,
    projectId: string,
    payload: { email: string; roleId: string },
  ): Promise<ProjectInvitationPayload> => {
    const res = await apiPost<BackendProjectInvitation>(
      `/workspaces/${workspaceId}/projects/${projectId}/invitations/email`,
      { email: payload.email, role_id: payload.roleId },
    );
    return mapProjectInvitation(res.data);
  },

  generateProjectInvitationLink: async (
    workspaceId: string,
    projectId: string,
    payload: { roleId: string; expiresAt?: string; maxUses?: number },
  ): Promise<ProjectInvitationPayload> => {
    const body: Record<string, unknown> = { role_id: payload.roleId };
    if (payload.expiresAt) body.expires_at = payload.expiresAt;
    if (payload.maxUses !== undefined) body.max_uses = payload.maxUses;
    const res = await apiPost<BackendProjectInvitation>(
      `/workspaces/${workspaceId}/projects/${projectId}/invitations/link`,
      body,
    );
    return mapProjectInvitation(res.data);
  },

  revokeProjectInvitation: async (
    workspaceId: string,
    projectId: string,
    invitationId: string,
  ): Promise<void> => {
    await apiPost(
      `/workspaces/${workspaceId}/projects/${projectId}/invitations/${invitationId}/revoke`,
    );
  },

  getProjectInvitationByToken: async (
    token: string,
  ): Promise<ProjectInvitationPayload> => {
    const res = await apiGet<BackendProjectInvitation>(
      `/project-invitations/token/${encodeURIComponent(token)}`,
    );
    return mapProjectInvitation(res.data);
  },

  acceptProjectInvitation: async (invitationId: string): Promise<{
    projectId: string;
    workspaceId: string;
    roleId: string;
    membershipType: string;
  }> => {
    const res = await apiPost<{
      project_id: string;
      workspace_id: string;
      role_id: string;
      membership_type: string;
    }>(`/project-invitations/${invitationId}/accept`);
    return {
      projectId: res.data.project_id,
      workspaceId: res.data.workspace_id,
      roleId: res.data.role_id,
      membershipType: res.data.membership_type,
    };
  },

  declineProjectInvitation: async (invitationId: string): Promise<void> => {
    await apiPost(`/project-invitations/${invitationId}/decline`);
  },

  acceptOrgInvitation: async (invitationId: string): Promise<void> => {
    await apiPost(`/orgs/invitations/${invitationId}/accept`);
  },

  declineOrgInvitation: async (invitationId: string): Promise<void> => {
    await apiPost(`/orgs/invitations/${invitationId}/decline`);
  },

  acceptWorkspaceInvitation: async (invitationId: string): Promise<void> => {
    await apiPost(`/workspaces/invitations/${invitationId}/accept`);
  },

  declineWorkspaceInvitation: async (invitationId: string): Promise<void> => {
    await apiPost(`/workspaces/invitations/${invitationId}/decline`);
  },

  redeemProjectInvitation: async (token: string): Promise<{
    projectId: string;
    workspaceId: string;
    roleId: string;
    membershipType: string;
  }> => {
    const res = await apiPost<{
      project_id: string;
      workspace_id: string;
      role_id: string;
      membership_type: string;
    }>(`/project-invitations/redeem`, { token });
    return {
      projectId: res.data.project_id,
      workspaceId: res.data.workspace_id,
      roleId: res.data.role_id,
      membershipType: res.data.membership_type,
    };
  },

  getMyProjectInvitations: async (): Promise<ProjectInvitationPayload[]> => {
    const res = await apiGetPaginated<BackendProjectInvitation>(
      `/project-invitations/mine`,
      { limit: "200" },
    );
    return (res.items ?? []).map(mapProjectInvitation);
  },

  // ── Tasks ────────────────────────────────────────────────────
  /**
   * Кросс-проектный список задач для текущего пользователя.
   * Использует backend-эндпоинт `GET /tasks/mine` (через `MyTasksController`),
   * вместо обхода всех проектов и склейки на клиенте.
   *
   * Параметр `workspaceId` принимается, но **не используется** (бэкенд возвращает
   * задачи пользователя из всех его рабочих пространств). Оставлен в сигнатуре
   * ради совместимости с существующими страницами.
   */
  getTasks: async (workspaceId?: string, filters?: {
    status?: string;
    priority?: string;
    role?: "assignee" | "reporter" | "watcher" | "all";
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<TaskPayload[]> => {
    void workspaceId; // ws-id игнорируется — see docstring
    const res = await apiGetPaginated<BackendTask>("/tasks/mine", {
      limit: filters?.limit ?? 200,
      offset: filters?.offset ?? 0,
      status: filters?.status,
      priority: filters?.priority,
      role: filters?.role,
      search: filters?.search,
    });
    return (res.items ?? []).map(mapTask);
  },

  getMyOverdueTasks: async (projectId?: string): Promise<TaskPayload[]> => {
    const res = await apiGetPaginated<BackendTask>("/tasks/mine/overdue", {
      project_id: projectId,
      limit: 100,
    });
    return (res.items ?? []).map(mapTask);
  },

  getProjectTasks: async (
    workspaceId: string,
    projectId: string,
  ): Promise<TaskPayload[]> => {
    const res = await apiGetPaginated<BackendTask>(
      `/workspaces/${workspaceId}/projects/${projectId}/tasks`,
    );
    return (res.items ?? []).map(mapTask);
  },

  /** Полная карточка задачи для task-detail dialog. */
  getTask: async (taskId: string): Promise<TaskDetailPayload> => {
    const res = await apiGet<BackendTask>(`/tasks/${taskId}`);
    return mapTaskDetail(res.data);
  },

  /**
   * Создание задачи с полным набором полей.
   *
   * Бэкенд `POST /workspaces/{ws}/projects/{p}/tasks` поддерживает только
   * `title` / `task_type` / `reporter_id` / `parent_task_id` / `epic_id`.
   * Остальные поля (description, priority, assignees, dates, effort, labels,
   * sprint, watchers) ставятся отдельными PATCH/POST после создания.
   *
   * Порядок: создаём → PATCH info → priority → assignees[] → effort → labels[]
   * → sprint → watchers[]. Любая после-создания ошибка логируется, но не
   * откатывает уже созданную задачу: возвращаем то, что есть.
   */
  createTask: async (payload: {
    workspaceId: string;
    projectId: string;
    title: string;
    taskType?: "TASK" | "BUG" | "FEATURE" | "IMPROVEMENT" | "SUBTASK";
    reporterId?: string;
    parentTaskId?: string;
    epicId?: string;
    description?: string;
    descriptionFormat?: "PLAIN" | "MARKDOWN" | "HTML";
    priority?: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "URGENT";
    assigneeIds?: string[];
    startDate?: string;
    dueDate?: string;
    effortEstimate?: { value: number; unit: "HOURS" | "STORY_POINTS" | "DAYS" | "T_SHIRT" };
    labels?: { name: string; color?: string }[];
    sprintId?: string;
    watcherIds?: string[];
  }): Promise<TaskPayload> => {
    // 1. Базовое создание
    const createBody: Record<string, unknown> = {
      title: payload.title,
      task_type: (payload.taskType ?? "TASK").toLowerCase(),
    };
    if (payload.reporterId) createBody.reporter_id = payload.reporterId;
    if (payload.parentTaskId) createBody.parent_task_id = payload.parentTaskId;
    if (payload.epicId) createBody.epic_id = payload.epicId;

    const res = await apiPost<BackendTask>(
      `/workspaces/${payload.workspaceId}/projects/${payload.projectId}/tasks`,
      createBody,
    );
    const task = mapTask(res.data);
    const taskId = task.id;

    // 2. PATCH /tasks/{id} — описание + даты (одним запросом).
    const hasInfoUpdate =
      payload.description != null ||
      payload.descriptionFormat != null ||
      payload.startDate != null ||
      payload.dueDate != null;
    if (hasInfoUpdate) {
      try {
        await apiPatch(`/tasks/${taskId}`, {
          description_content: payload.description,
          description_format: payload.descriptionFormat?.toLowerCase(),
          start_date: payload.startDate,
          due_date: payload.dueDate,
        });
      } catch (err) {
        console.warn("createTask: updateInfo failed", err);
      }
    }

    // 3. Приоритет (если != NONE и != дефолт).
    if (payload.priority && payload.priority !== "NONE") {
      try {
        await apiPost(`/tasks/${taskId}/change-priority`, { priority: payload.priority.toLowerCase() });
      } catch (err) {
        console.warn("createTask: changePriority failed", err);
      }
    }

    // 4. Исполнители (последовательно, чтобы получить корректные ошибки).
    if (payload.assigneeIds && payload.assigneeIds.length > 0) {
      for (const userId of payload.assigneeIds) {
        try {
          await apiPost(`/tasks/${taskId}/assignees`, { assignee_id: userId });
        } catch (err) {
          console.warn(`createTask: assign ${userId} failed`, err);
        }
      }
    }

    // 5. Оценка усилия.
    if (payload.effortEstimate) {
      try {
        await apiPatch(`/tasks/${taskId}/effort-estimate`, {
          value: payload.effortEstimate.value,
          unit: payload.effortEstimate.unit.toLowerCase(),
        });
      } catch (err) {
        console.warn("createTask: effortEstimate failed", err);
      }
    }

    // 6. Метки.
    if (payload.labels && payload.labels.length > 0) {
      for (const label of payload.labels) {
        try {
          await apiPost(`/tasks/${taskId}/labels`, {
            name: label.name,
            color: label.color,
          });
        } catch (err) {
          console.warn(`createTask: addLabel ${label.name} failed`, err);
        }
      }
    }

    // 7. Спринт.
    if (payload.sprintId) {
      try {
        await apiPost(`/tasks/${taskId}/sprint`, { sprint_id: payload.sprintId });
      } catch (err) {
        console.warn("createTask: assignToSprint failed", err);
      }
    }

    // 8. Наблюдатели.
    if (payload.watcherIds && payload.watcherIds.length > 0) {
      for (const userId of payload.watcherIds) {
        try {
          await apiPost(`/tasks/${taskId}/watchers`, { user_id: userId });
        } catch (err) {
          console.warn(`createTask: addWatcher ${userId} failed`, err);
        }
      }
    }

    // Получим задачу заново, чтобы вернуть её актуальное состояние с применёнными
    // полями (priority/labels/assignees могут быть видны на доске сразу).
    try {
      const refreshed = await apiGet<BackendTask>(`/tasks/${taskId}`);
      return mapTask(refreshed.data);
    } catch {
      return task;
    }
  },

  /** Обновление заголовка/описания/дат. */
  updateTaskInfo: async (
    taskId: string,
    payload: {
      title?: string;
      description?: string;
      descriptionFormat?: "PLAIN" | "MARKDOWN" | "HTML";
      startDate?: string;
      dueDate?: string;
    },
  ): Promise<void> => {
    await apiPatch(`/tasks/${taskId}`, {
      title: payload.title,
      description_content: payload.description,
      // RichTextFormat enum на бэке lowercase — нормализуем (см. updateProjectInfo).
      description_format: payload.descriptionFormat?.toLowerCase(),
      start_date: payload.startDate,
      due_date: payload.dueDate,
    });
  },

  deleteTask: async (taskId: string): Promise<void> => {
    await apiDelete(`/tasks/${taskId}`);
  },

  archiveTask: async (taskId: string): Promise<void> => {
    await apiPost(`/tasks/${taskId}/archive`);
  },

  restoreTask: async (taskId: string): Promise<void> => {
    await apiPost(`/tasks/${taskId}/restore`);
  },

  /**
   * DnD-перемещение задачи между колонками (с позицией внутри колонки).
   * `column_id` — UUID реальной board-колонки (не synthetic key).
   */
  moveTask: async (
    taskId: string,
    payload: { columnId: string; position: number },
  ): Promise<void> => {
    await apiPost(`/tasks/${taskId}/move`, {
      column_id: payload.columnId,
      position: payload.position,
    });
  },

  /**
   * Сменить workflow-статус задачи.
   * `statusId` — UUID workflow-статуса (поле `status_id` колонки доски).
   */
  updateTaskStatus: async (
    taskId: string,
    statusId: string,
  ): Promise<void> => {
    await apiPost(`/tasks/${taskId}/change-status`, {
      new_status_id: statusId,
    });
  },

  changeTaskPriority: async (
    taskId: string,
    priority: string,
  ): Promise<void> => {
    await apiPost(`/tasks/${taskId}/change-priority`, {
      priority: priority.toLowerCase(),
    });
  },

  // ── Task assignees / sprint / epic links ─────────────────────
  assignTask: async (taskId: string, userId: string): Promise<void> => {
    await apiPost(`/tasks/${taskId}/assignees`, { assignee_id: userId });
  },

  unassignTask: async (taskId: string, userId: string): Promise<void> => {
    await apiDelete(`/tasks/${taskId}/assignees/${userId}`);
  },

  assignTaskToSprint: async (taskId: string, sprintId: string): Promise<void> => {
    await apiPost(`/tasks/${taskId}/sprint`, { sprint_id: sprintId });
  },

  removeTaskFromSprint: async (taskId: string): Promise<void> => {
    await apiDelete(`/tasks/${taskId}/sprint`);
  },

  assignTaskToEpic: async (taskId: string, epicId: string): Promise<void> => {
    await apiPost(`/tasks/${taskId}/epic`, { epic_id: epicId });
  },

  removeTaskFromEpic: async (taskId: string): Promise<void> => {
    await apiDelete(`/tasks/${taskId}/epic`);
  },

  // ── Task checklists ───────────────────────────────────────────
  addChecklist: async (taskId: string, title: string): Promise<void> => {
    await apiPost(`/tasks/${taskId}/checklists`, { title });
  },

  removeChecklist: async (taskId: string, checklistId: string): Promise<void> => {
    await apiDelete(`/tasks/${taskId}/checklists/${checklistId}`);
  },

  addChecklistItem: async (
    taskId: string,
    checklistId: string,
    payload: { text: string; assigneeId?: string; dueDate?: string },
  ): Promise<void> => {
    await apiPost(`/tasks/${taskId}/checklists/${checklistId}/items`, {
      text: payload.text,
      assignee_id: payload.assigneeId,
      due_date: payload.dueDate,
    });
  },

  toggleChecklistItem: async (
    taskId: string,
    checklistId: string,
    itemId: string,
  ): Promise<void> => {
    await apiPost(`/tasks/${taskId}/checklists/${checklistId}/items/${itemId}/toggle`);
  },

  // ── Task history / changelog ─────────────────────────────────
  getTaskChangelog: async (
    taskId: string,
    fieldName?: string,
  ): Promise<TaskChangelogEntryPayload[]> => {
    const path = fieldName
      ? `/tasks/${taskId}/changelog/${fieldName}`
      : `/tasks/${taskId}/changelog`;
    const res = await apiGetPaginated<{
      id: string;
      field_name: string;
      old_value?: string | null;
      new_value?: string | null;
      changed_at: string;
      changed_by: string;
    }>(path, { limit: 200 });
    return (res.items ?? []).map((e) => ({
      id: e.id,
      fieldName: e.field_name,
      oldValue: e.old_value,
      newValue: e.new_value,
      changedAt: e.changed_at,
      changedBy: e.changed_by,
    }));
  },

  getSubtasks: async (taskId: string): Promise<TaskPayload[]> => {
    const res = await apiGetPaginated<BackendTask>(`/tasks/${taskId}/subtasks`, {
      limit: 100,
    });
    return (res.items ?? []).map(mapTask);
  },

  // ── Comments (Communication BC, exposed here for task-detail) ─
  /**
   * Список комментариев по target_type+target_id.
   *
   * Бэкенд возвращает `SuccessResponse[CommentListResponse]` —
   * то есть `{ success, data: { items, total } }`. Используем `apiGet`
   * и разворачиваем `data.items`. Раньше тут стоял `apiGetPaginated`,
   * который читает items с корня → всегда возвращал пустой массив.
   * Из-за этого комментарии «исчезали» после перезагрузки страницы.
   */
  listComments: async (
    targetType: "task" | "project" | "epic" | "sprint",
    targetId: string,
  ): Promise<CommentPayload[]> => {
    const res = await apiGet<{ items: BackendComment[]; total: number }>(
      "/comments/",
      {
        target_type: targetType,
        target_id: targetId,
      },
    );
    return (res.data.items ?? []).map(mapComment);
  },

  addComment: async (payload: {
    targetType: "task" | "project" | "epic" | "sprint";
    targetId: string;
    content: string;
    contentFormat?: "markdown" | "wysiwyg" | "plain";
    parentCommentId?: string;
  }): Promise<CommentPayload> => {
    const res = await apiPost<BackendComment>("/comments/", {
      target_type: payload.targetType,
      target_id: payload.targetId,
      content: payload.content.trim() ? payload.content : null,
      content_format: payload.contentFormat ?? "markdown",
      parent_comment_id: payload.parentCommentId,
    });
    return mapComment(res.data);
  },

  addCommentAttachment: async (
    commentId: string,
    file: File,
    attachmentType: "image" | "video" | "file" | "link" | "voice" = "file",
  ): Promise<CommentAttachmentShape> => {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("attachment_type", attachmentType);
    const res = await apiPostMultipart<{ id: string; file_id: string; url?: string | null; attachment_type?: string | null; name?: string | null; size_bytes?: number | null; preview_url?: string | null; created_at?: string | null }>(
      `/comments/${commentId}/attachments`,
      form,
    );
    return {
      id: res.data.id,
      fileId: res.data.file_id,
      url: res.data.url ?? undefined,
      attachmentType: res.data.attachment_type ?? undefined,
      name: res.data.name ?? undefined,
      sizeBytes: res.data.size_bytes ?? undefined,
      previewUrl: res.data.preview_url ?? undefined,
      createdAt: res.data.created_at ?? undefined,
    };
  },

  removeCommentAttachment: async (commentId: string, attachmentId: string): Promise<void> => {
    await apiDelete(`/comments/${commentId}/attachments/${attachmentId}`);
  },

  addTaskAttachment: async (
    taskId: string,
    file: File,
  ): Promise<{ fileId: string }> => {
    const form = new FormData();
    form.append("file", file, file.name);
    const res = await apiPostMultipart<{ file_id: string }>(`/tasks/${taskId}/attachments`, form);
    return { fileId: res.data.file_id };
  },

  removeTaskAttachment: async (taskId: string, fileId: string): Promise<void> => {
    await apiDelete(`/tasks/${taskId}/attachments/${fileId}`);
  },

  deleteComment: async (commentId: string): Promise<void> => {
    await apiDelete(`/comments/${commentId}`);
  },

  // ── Sprints ──────────────────────────────────────────────────
  getSprints: async (
    workspaceId: string,
    projectId: string,
  ): Promise<SprintPayload[]> => {
    const res = await apiGet<BackendSprint[]>(
      `/workspaces/${workspaceId}/projects/${projectId}/sprints`,
    );
    return (res.data ?? []).map(mapSprint);
  },

  getActiveSprint: async (
    workspaceId: string,
    projectId: string,
  ): Promise<SprintPayload | null> => {
    try {
      const res = await apiGet<BackendSprint>(
        `/workspaces/${workspaceId}/projects/${projectId}/sprints/active`,
      );
      return mapSprint(res.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  createSprint: async (
    workspaceId: string,
    projectId: string,
    payload: { name: string; goal?: string; startDate?: string; endDate?: string },
  ): Promise<SprintPayload> => {
    const res = await apiPost<BackendSprint>(
      `/workspaces/${workspaceId}/projects/${projectId}/sprints`,
      {
        name: payload.name,
        goal: payload.goal,
        start_date: payload.startDate,
        end_date: payload.endDate,
      },
    );
    return mapSprint(res.data);
  },

  startSprint: async (
    workspaceId: string,
    projectId: string,
    sprintId: string,
  ): Promise<void> => {
    await apiPost(
      `/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}/start`,
    );
  },

  completeSprint: async (
    workspaceId: string,
    projectId: string,
    sprintId: string,
  ): Promise<void> => {
    await apiPost(
      `/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}/complete`,
    );
  },

  cancelSprint: async (
    workspaceId: string,
    projectId: string,
    sprintId: string,
  ): Promise<void> => {
    await apiPost(
      `/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}/cancel`,
    );
  },

  // ── Epics ────────────────────────────────────────────────────
  getEpics: async (
    workspaceId: string,
    projectId: string,
  ): Promise<EpicPayload[]> => {
    const res = await apiGet<BackendEpic[]>(
      `/workspaces/${workspaceId}/projects/${projectId}/epics`,
    );
    return (res.data ?? []).map(mapEpic);
  },

  createEpic: async (
    workspaceId: string,
    projectId: string,
    payload: { name: string; description?: string; color?: string },
  ): Promise<EpicPayload> => {
    const res = await apiPost<BackendEpic>(
      `/workspaces/${workspaceId}/projects/${projectId}/epics`,
      {
        name: payload.name,
        description: payload.description,
        color: payload.color,
      },
    );
    return mapEpic(res.data);
  },

  updateEpic: async (
    workspaceId: string,
    projectId: string,
    epicId: string,
    payload: { name?: string; description?: string; color?: string },
  ): Promise<void> => {
    await apiPatch(
      `/workspaces/${workspaceId}/projects/${projectId}/epics/${epicId}`,
      payload,
    );
  },

  suspendProject: async (workspaceId: string, projectId: string): Promise<void> => {
    await apiPost(`/workspaces/${workspaceId}/projects/${projectId}/suspend`);
  },

  reactivateProject: async (workspaceId: string, projectId: string): Promise<void> => {
    await apiPost(`/workspaces/${workspaceId}/projects/${projectId}/reactivate`);
  },

  // ── Board / Workflow ─────────────────────────────────────────
  getBoardData: async (
    workspaceId: string,
    projectId: string,
  ): Promise<{ columns: BoardColumnPayload[]; workflowStatuses: WorkflowStatusPayload[] }> => {
    const res = await apiGet<{
      columns: BackendBoardColumn[];
      workflow_statuses: BackendWorkflowStatus[];
    }>(
      `/workspaces/${workspaceId}/projects/${projectId}/board`,
    );
    return {
      columns: (res.data.columns ?? []).map(mapBoardColumn),
      workflowStatuses: (res.data.workflow_statuses ?? []).map(mapWorkflowStatus),
    };
  },

  // ── Analytics ────────────────────────────────────────────────
  getAnalytics: async (workspaceId: string): Promise<AnalyticsPayload> => {
    const tasks = await api.getTasks(workspaceId);
    const dist: Record<string, number> = {};
    tasks.forEach((t) => {
      dist[t.status] = (dist[t.status] ?? 0) + 1;
    });
    const isDone = (s: string) => {
      const l = s?.toLowerCase() ?? "";
      return l === "done" || l === "completed" || l === "closed";
    };
    return {
      throughput: tasks.filter((t) => isDone(t.status)).length,
      overdue: tasks.filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) < new Date() &&
          !isDone(t.status),
      ).length,
      totalTasks: tasks.length,
      statusDistribution: dist,
    };
  },

  // ── Communication BC: Chats ──────────────────────────────────
  /**
   * Мои чаты.
   *
   * Бэкенд возвращает `SuccessResponse[ChatListResponse]` —
   * то есть `{ success, data: { items, total } }`. Используем `apiGet`
   * и разворачиваем `data.items`. Раньше тут стоял `apiGetPaginated`,
   * который читает items с корня → всегда возвращал пустой массив.
   * Из-за этого чаты «не появлялись» на странице /chats, даже когда
   * пользователь получал WS-уведомление «вас добавили в чат».
   */
  listChats: async (): Promise<ChatPayload[]> => {
    const res = await apiGet<{ items: BackendChat[]; total: number }>(
      "/chats/",
      { limit: "200" },
    );
    return (res.data.items ?? []).map(mapChat);
  },

  getChat: async (chatId: string): Promise<ChatPayload> => {
    const res = await apiGet<BackendChat>(`/chats/${chatId}`);
    return mapChat(res.data);
  },

  createDm: async (otherUserId: string): Promise<ChatPayload> => {
    const res = await apiPost<BackendChat>("/chats/dm", { other_user_id: otherUserId });
    return mapChat(res.data);
  },

  createGroupChat: async (name: string): Promise<ChatPayload> => {
    const res = await apiPost<BackendChat>("/chats/group", { name });
    return mapChat(res.data);
  },

  createChannel: async (workspaceId: string, name: string): Promise<ChatPayload> => {
    const res = await apiPost<BackendChat>("/chats/channel", {
      name,
      workspace_id: workspaceId,
    });
    return mapChat(res.data);
  },

  updateChat: async (
    chatId: string,
    payload: { name?: string; description?: string; icon?: string; color?: string },
  ): Promise<void> => {
    await apiPatch(`/chats/${chatId}`, payload);
  },

  archiveChat: async (chatId: string): Promise<void> => {
    await apiPost(`/chats/${chatId}/archive`);
  },

  restoreChat: async (chatId: string): Promise<void> => {
    await apiPost(`/chats/${chatId}/restore`);
  },

  markChatRead: async (chatId: string): Promise<void> => {
    await apiPost(`/chats/${chatId}/read`);
  },

  getChatUnreadCount: async (chatId: string): Promise<number> => {
    const res = await apiGet<{ unread_count: number }>(`/chats/${chatId}/unread-count`);
    return res.data.unread_count ?? 0;
  },

  addChatMember: async (chatId: string, userId: string): Promise<void> => {
    await apiPost(`/chats/${chatId}/members`, { user_id: userId });
  },

  removeChatMember: async (chatId: string, userId: string): Promise<void> => {
    await apiDelete(`/chats/${chatId}/members/${userId}`);
  },

  // ── Communication BC: Messages ───────────────────────────────
  listMessages: async (
    chatId: string,
    filters?: { limit?: number; before?: string; after?: string },
  ): Promise<{ items: MessagePayload[]; hasMore: boolean }> => {
    const res = await apiGet<{
      items: BackendMessage[];
      total: number;
      has_more: boolean;
    }>(`/chats/${chatId}/messages`, {
      limit: filters?.limit ?? 100,
      before: filters?.before,
      after: filters?.after,
    });
    // Бэкенд (`SqlMessageRepository.get_by_chat`) сортирует DESC по
    // `created_at` (новые сверху) — удобно для пагинации "load more",
    // но не для рендера ленты. UI ожидает хронологический порядок:
    // старые сверху, новые внизу. Разворачиваем здесь, чтобы все
    // потребители (`chats-page`, превью списка) получали единый порядок,
    // и оптимистичный append в конец массива был всегда корректен.
    const items = (res.data.items ?? []).map(mapMessage).reverse();
    // Дополнительно страхуемся от возможных временных рассинхронов —
    // если у двух сообщений `createdAt` отличается, гарантируем ASC.
    items.sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return ta - tb;
    });
    return {
      items,
      hasMore: res.data.has_more ?? false,
    };
  },

  sendMessage: async (
    chatId: string,
    payload: {
      content: string;
      contentFormat?: "markdown" | "plain";
      threadId?: string;
      replyToId?: string;
      messageType?: string;
    },
  ): Promise<MessagePayload> => {
    const res = await apiPost<BackendMessage>(`/chats/${chatId}/messages`, {
      content: payload.content.trim() ? payload.content : null,
      content_format: payload.contentFormat ?? "markdown",
      thread_id: payload.threadId,
      reply_to_id: payload.replyToId,
      message_type: payload.messageType ?? "text",
    });
    return mapMessage(res.data);
  },

  addMessageAttachment: async (
    messageId: string,
    file: File,
    attachmentType: "image" | "video" | "file" | "link" | "voice" = "file",
  ): Promise<MessageAttachmentShape> => {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("attachment_type", attachmentType);
    // Backend `AttachmentResponse` сериализует имя как `name` и не отдаёт
    // `mime_type` — `filename`/`mime_type` оставлены как fallback.
    const res = await apiPostMultipart<{
      id: string;
      file_id: string;
      name?: string | null;
      filename?: string | null;
      size_bytes?: number | null;
      attachment_type?: string | null;
      mime_type?: string | null;
    }>(`/messages/${messageId}/attachments`, form);
    return {
      id: res.data.id,
      fileId: res.data.file_id,
      filename: res.data.name ?? res.data.filename ?? file.name,
      sizeBytes: res.data.size_bytes ?? undefined,
      mimeType:
        res.data.mime_type ?? attachmentTypeToMime(res.data.attachment_type) ?? file.type ?? undefined,
    };
  },

  removeMessageAttachment: async (messageId: string, attachmentId: string): Promise<void> => {
    await apiDelete(`/messages/${messageId}/attachments/${attachmentId}`);
  },

  updateMessage: async (
    messageId: string,
    payload: { content: string; contentFormat?: string },
  ): Promise<void> => {
    await apiPatch(`/messages/${messageId}`, {
      content: payload.content,
      content_format: payload.contentFormat ?? "markdown",
    });
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    await apiDelete(`/messages/${messageId}`);
  },

  addMessageReaction: async (messageId: string, emoji: string): Promise<void> => {
    await apiPost(`/messages/${messageId}/reactions`, { emoji });
  },

  removeMessageReaction: async (messageId: string, emoji: string): Promise<void> => {
    await apiDelete(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
  },

  // ── Communication BC: Meetings ───────────────────────────────
  listMyMeetings: async (filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<MeetingPayload[]> => {
    const res = await apiGet<{ items: BackendMeeting[]; total: number }>(
      "/meetings/",
      {
        status: filters?.status,
        date_from: filters?.dateFrom,
        date_to: filters?.dateTo,
      },
    );
    return (res.data.items ?? []).map(mapMeeting);
  },

  listWorkspaceMeetings: async (workspaceId: string): Promise<MeetingPayload[]> => {
    const res = await apiGet<{ items: BackendMeeting[]; total: number }>(
      `/meetings/by-workspace/${workspaceId}`,
    );
    return (res.data.items ?? []).map(mapMeeting);
  },

  listProjectMeetings: async (projectId: string): Promise<MeetingPayload[]> => {
    const res = await apiGet<{ items: BackendMeeting[]; total: number }>(
      `/meetings/by-project/${projectId}`,
    );
    return (res.data.items ?? []).map(mapMeeting);
  },

  getMeeting: async (meetingId: string): Promise<MeetingPayload> => {
    const res = await apiGet<BackendMeeting>(`/meetings/${meetingId}`);
    return mapMeeting(res.data);
  },

  createMeeting: async (payload: {
    workspaceId: string;
    title: string;
    description?: string;
    meetingType?: string;
    scheduledAt?: string;
    durationMinutes?: number;
    location?: string;
    projectId?: string;
    participantIds?: string[];
    agenda?: string[];
  }): Promise<MeetingPayload> => {
    const res = await apiPost<BackendMeeting>("/meetings/", {
      title: payload.title,
      description: payload.description,
      meeting_type: payload.meetingType ?? "sync",
      workspace_id: payload.workspaceId,
      project_id: payload.projectId,
      scheduled_at: payload.scheduledAt,
      duration_minutes: payload.durationMinutes,
      location: payload.location,
      participant_ids: payload.participantIds,
      agenda: payload.agenda,
    });
    return mapMeeting(res.data);
  },

  updateMeeting: async (
    meetingId: string,
    payload: {
      title?: string;
      description?: string;
      scheduledAt?: string;
      durationMinutes?: number;
      location?: string;
      agenda?: string[];
    },
  ): Promise<void> => {
    await apiPatch(`/meetings/${meetingId}`, {
      title: payload.title,
      description: payload.description,
      scheduled_at: payload.scheduledAt,
      duration_minutes: payload.durationMinutes,
      location: payload.location,
      agenda: payload.agenda,
    });
  },

  startMeeting: async (meetingId: string): Promise<void> => {
    await apiPost(`/meetings/${meetingId}/start`);
  },

  completeMeeting: async (meetingId: string): Promise<void> => {
    await apiPost(`/meetings/${meetingId}/complete`);
  },

  cancelMeeting: async (meetingId: string): Promise<void> => {
    await apiPost(`/meetings/${meetingId}/cancel`);
  },

  joinMeeting: async (meetingId: string): Promise<MeetingJoinPayload> => {
    const res = await apiPost<{
      join_url: string;
      access_token?: string | null;
      provider: string;
    }>(`/meetings/${meetingId}/join`);
    return {
      joinUrl: res.data.join_url,
      accessToken: res.data.access_token ?? undefined,
      provider: res.data.provider,
    };
  },

  updateMeetingRsvp: async (
    meetingId: string,
    rsvp: "pending" | "accepted" | "declined" | "tentative",
  ): Promise<void> => {
    await apiPost(`/meetings/${meetingId}/rsvp`, { rsvp_status: rsvp });
  },

  // ── FileStorage BC: Folders ──────────────────────────────────
  listFolders: async (workspaceId: string): Promise<FolderPayload[]> => {
    const res = await apiGet<{ items: BackendFolder[]; total: number }>(
      "/folders/",
      { workspace_id: workspaceId },
    );
    return (res.data.items ?? []).map(mapFolder);
  },

  listSubfolders: async (folderId: string): Promise<FolderPayload[]> => {
    const res = await apiGet<{ items: BackendFolder[]; total: number }>(
      `/folders/${folderId}/subfolders`,
    );
    return (res.data.items ?? []).map(mapFolder);
  },

  createFolder: async (payload: {
    workspaceId: string;
    name: string;
    parentFolderId?: string;
    color?: string;
    description?: string;
    icon?: string;
  }): Promise<FolderPayload> => {
    const res = await apiPost<BackendFolder>("/folders/", {
      workspace_id: payload.workspaceId,
      name: payload.name,
      parent_folder_id: payload.parentFolderId,
      color: payload.color,
      description: payload.description,
      icon: payload.icon,
    });
    return mapFolder(res.data);
  },

  renameFolder: async (folderId: string, newName: string): Promise<FolderPayload> => {
    const res = await apiPatch<BackendFolder>(`/folders/${folderId}/rename`, {
      new_name: newName,
    });
    return mapFolder(res.data);
  },

  moveFolder: async (folderId: string, newParentFolderId: string): Promise<FolderPayload> => {
    const res = await apiPost<BackendFolder>(`/folders/${folderId}/move`, {
      new_parent_folder_id: newParentFolderId,
    });
    return mapFolder(res.data);
  },

  deleteFolder: async (folderId: string): Promise<void> => {
    await apiDelete(`/folders/${folderId}`);
  },

  pinFolder: async (folderId: string): Promise<void> => {
    await apiPost(`/folders/${folderId}/pin`);
  },

  unpinFolder: async (folderId: string): Promise<void> => {
    await apiPost(`/folders/${folderId}/unpin`);
  },

  // ── FileStorage BC: Files ────────────────────────────────────
  listFolderFiles: async (folderId: string): Promise<FilePayload[]> => {
    const res = await apiGet<{ items: BackendFile[]; total: number }>(
      `/folders/${folderId}/files`,
    );
    return (res.data.items ?? []).map(mapFile);
  },

  listWorkspaceFiles: async (
    workspaceId: string,
    filters?: { query?: string; fileType?: string; tag?: string },
  ): Promise<FilePayload[]> => {
    const res = await apiGet<{ items: BackendFile[]; total: number }>("/files/", {
      workspace_id: workspaceId,
      query: filters?.query,
      file_type: filters?.fileType,
      tag: filters?.tag,
    });
    return (res.data.items ?? []).map(mapFile);
  },

  getFile: async (fileId: string): Promise<FilePayload> => {
    const res = await apiGet<BackendFile>(`/files/${fileId}`);
    return mapFile(res.data);
  },

  /**
   * Загрузка одного файла. Использует `multipart/form-data`. Если папка не указана —
   * файл создаётся в корне workspace.
   */
  uploadFile: async (
    workspaceId: string,
    file: File,
    options?: { folderId?: string; description?: string },
  ): Promise<FilePayload> => {
    const form = new FormData();
    form.append("workspace_id", workspaceId);
    form.append("file", file, file.name);
    if (options?.folderId) form.append("folder_id", options.folderId);
    if (options?.description) form.append("description", options.description);
    const res = await apiPostMultipart<BackendFile>("/files/", form);
    return mapFile(res.data);
  },

  getFileDownloadUrl: async (fileId: string): Promise<FileDownloadPayload> => {
    const res = await apiGet<{
      url: string;
      expires_in: number;
      file_id: string;
      name: string;
      mime_type: string;
      size_bytes: number;
    }>(`/files/${fileId}/download`);
    return {
      url: res.data.url,
      expiresIn: res.data.expires_in,
      fileId: res.data.file_id,
      name: res.data.name,
      mimeType: res.data.mime_type,
      sizeBytes: res.data.size_bytes,
    };
  },

  renameFile: async (fileId: string, newName: string): Promise<FilePayload> => {
    const res = await apiPatch<BackendFile>(`/files/${fileId}/rename`, {
      new_name: newName,
    });
    return mapFile(res.data);
  },

  moveFile: async (fileId: string, newFolderId: string | null): Promise<FilePayload> => {
    const res = await apiPost<BackendFile>(`/files/${fileId}/move`, {
      new_folder_id: newFolderId,
    });
    return mapFile(res.data);
  },

  trashFile: async (fileId: string): Promise<void> => {
    await apiPost(`/files/${fileId}/trash`);
  },

  restoreFile: async (fileId: string): Promise<void> => {
    await apiPost(`/files/${fileId}/restore`);
  },

  deleteFile: async (fileId: string): Promise<void> => {
    await apiDelete(`/files/${fileId}`);
  },

  // ── FileStorage BC: Share Links ──────────────────────────────
  createShareLink: async (
    fileId: string,
    payload?: {
      accessLevel?: "view" | "edit";
      allowDownload?: boolean;
      expiresAt?: string;
      maxUses?: number;
      password?: string;
    },
  ): Promise<ShareLinkPayload> => {
    const res = await apiPost<BackendShareLink>(`/files/${fileId}/share-links`, {
      access_level: payload?.accessLevel ?? "view",
      allow_download: payload?.allowDownload ?? true,
      expires_at: payload?.expiresAt,
      max_uses: payload?.maxUses,
      password: payload?.password,
    });
    return {
      id: res.data.id,
      token: res.data.token,
      hasPassword: res.data.has_password,
      expiresAt: res.data.expires_at ?? undefined,
      accessLevel: res.data.access_level,
      allowDownload: res.data.allow_download,
      maxUses: res.data.max_uses ?? undefined,
      currentUses: res.data.current_uses,
      createdBy: res.data.created_by,
      createdAt: res.data.created_at ?? undefined,
    };
  },

  revokeShareLink: async (fileId: string, linkId: string): Promise<void> => {
    await apiDelete(`/files/${fileId}/share-links/${linkId}`);
  },

  // ── Notifications (Notification BC) ─────────────────────────
  /**
   * Получить список уведомлений текущего пользователя.
   *
   * Бэкенд: `GET /notifications/` с фильтрами (`workspace_id`,
   * `notification_type`, `is_read`) и пагинацией.
   * Архивированные уведомления исключаются на стороне бэкенда.
   */
  getNotifications: async (params?: {
    workspaceId?: string;
    type?: string;
    isRead?: boolean;
    page?: number;
    limit?: number;
  }): Promise<NotificationPayload[]> => {
    type BackendNotification = {
      id: string;
      recipient_id: string;
      workspace_id?: string | null;
      notification_type: string;
      title: string;
      body: string;
      priority: string;
      data?: Record<string, unknown> | null;
      channels?: string[] | null;
      is_read: boolean;
      read_at?: string | null;
      is_archived: boolean;
      actor_id?: string | null;
      created_at?: string | null;
    };
    const query: Record<string, string> = {};
    if (params?.workspaceId) query.workspace_id = params.workspaceId;
    if (params?.type) query.notification_type = params.type;
    if (params?.isRead !== undefined) query.is_read = String(params.isRead);
    if (params?.page) query.page = String(params.page);
    if (params?.limit) query.limit = String(params.limit);
    const res = await apiGet<BackendNotification[]>("/notifications/", query);
    return (res.data ?? []).map((n) => ({
      id: n.id,
      recipientId: n.recipient_id,
      workspaceId: n.workspace_id ?? undefined,
      notificationType: n.notification_type,
      title: n.title,
      body: n.body,
      priority: n.priority,
      data: n.data ?? {},
      channels: n.channels ?? [],
      isRead: n.is_read,
      readAt: n.read_at ?? undefined,
      isArchived: n.is_archived,
      actorId: n.actor_id ?? undefined,
      createdAt: n.created_at ?? undefined,
    }));
  },

  /**
   * Получить количество непрочитанных уведомлений.
   * Используется для badge'а на колокольчике в шапке.
   * Бэкенд: `GET /notifications/unread-count`.
   */
  getUnreadNotificationsCount: async (): Promise<UnreadCountPayload> => {
    type BackendUnread = {
      total: number;
      by_workspace?: Record<string, number> | null;
    };
    const res = await apiGet<BackendUnread>("/notifications/unread-count");
    return {
      total: res.data.total,
      byWorkspace: res.data.by_workspace ?? {},
    };
  },

  /**
   * Пометить одно уведомление как прочитанное.
   * Бэкенд: `PATCH /notifications/{id}/read`.
   */
  markNotificationRead: async (notificationId: string): Promise<void> => {
    await apiPatch(`/notifications/${notificationId}/read`, {});
  },

  /**
   * Пометить ВСЕ уведомления как прочитанные (опционально в рамках workspace).
   * Бэкенд: `POST /notifications/read-all`.
   */
  markAllNotificationsRead: async (workspaceId?: string): Promise<void> => {
    await apiPost("/notifications/read-all", workspaceId ? { workspace_id: workspaceId } : {});
  },

  /**
   * Архивировать уведомление (скрыть из основного списка).
   * Бэкенд: `PATCH /notifications/{id}/archive`.
   */
  archiveNotification: async (notificationId: string): Promise<void> => {
    await apiPatch(`/notifications/${notificationId}/archive`, {});
  },

  /**
   * Получить параметры WS-подключения (URL, метод авторизации, heartbeat).
   * Бэкенд: `GET /notifications/connection-info`.
   *
   * Возвращаемый URL уже содержит схему (`ws://` или `wss://`) и
   * полный путь. Клиент должен сам приложить JWT через query-параметр
   * `?token=<jwt>` (см. `getWsToken`).
   */
  getNotificationsConnectionInfo: async (): Promise<NotificationConnectionInfo> => {
    type BackendCI = {
      websocket_url: string;
      auth_method: string;
      auth_param: string;
      heartbeat_interval_sec: number;
      server_events: string[];
      client_messages: string[];
    };
    const res = await apiGet<BackendCI>("/notifications/connection-info");
    // Бэкенд может вернуть `ws://0.0.0.0:8000/...` (Docker default) —
    // для браузера это невалидный адрес. Подменяем хост на текущий hostname
    // страницы, чтобы WS-соединение шло туда же, откуда загружен фронтенд.
    let wsUrl = res.data.websocket_url;
    try {
      const u = new URL(wsUrl);
      if (u.hostname === "0.0.0.0") {
        u.hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
        wsUrl = u.toString();
      }
    } catch { /* invalid URL — use as-is */ }
    return {
      websocketUrl: wsUrl,
      authMethod: res.data.auth_method,
      authParam: res.data.auth_param,
      heartbeatIntervalSec: res.data.heartbeat_interval_sec,
      serverEvents: res.data.server_events ?? [],
      clientMessages: res.data.client_messages ?? [],
    };
  },

  /**
   * Получить короткоживущий JWT для подключения к WebSocket.
   *
   * Идёт НЕ через `/api/proxy/...`, а через локальный Next-роут
   * `/api/auth/ws-token`, который читает httpOnly-cookie с access-токеном
   * и при необходимости рефрешит его. Это единственное место в SPA,
   * где сырой JWT попадает в JS-память — и только на время открытия WS.
   */
  getWsToken: async (): Promise<string> => {
    const res = await fetch("/api/auth/ws-token", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`ws-token fetch failed: ${res.status}`);
    }
    const json = (await res.json()) as { data?: { token?: string } };
    const token = json.data?.token;
    if (!token) throw new Error("ws-token response missing token");
    return token;
  },

  // ── Analytics ───────────────────────────────────────────────

  /**
   * Получить все дашборды workspace, видимые текущему пользователю.
   * Бэкенд: `GET /dashboards?workspace_id=<id>`.
   */
  listDashboards: async (workspaceId: string): Promise<DashboardPayload[]> => {
    const res = await apiGet<BackendDashboard[]>("/dashboards", {
      workspace_id: workspaceId,
    });
    return (res.data ?? []).map(mapDashboard);
  },

  /** Дашборды, расшаренные текущим пользователем (любой workspace). */
  listDashboardsSharedWithMe: async (): Promise<DashboardPayload[]> => {
    const res = await apiGet<BackendDashboard[]>("/dashboards/shared-with-me");
    return (res.data ?? []).map(mapDashboard);
  },

  /** Полные данные одного дашборда вместе с виджетами. */
  getDashboard: async (dashboardId: string): Promise<DashboardPayload> => {
    const res = await apiGet<BackendDashboard>(`/dashboards/${dashboardId}`);
    return mapDashboard(res.data);
  },

  /**
   * Создать новый пустой дашборд внутри workspace.
   * Бэкенд: `POST /dashboards` с `CreateDashboardRequest`.
   */
  createDashboard: async (payload: {
    workspaceId: string;
    name: string;
    description?: string;
  }): Promise<DashboardPayload> => {
    const res = await apiPost<BackendDashboard>("/dashboards", {
      workspace_id: payload.workspaceId,
      name: payload.name,
      ...(payload.description ? { description: payload.description } : {}),
    });
    return mapDashboard(res.data);
  },

  /** Удалить дашборд. */
  deleteDashboard: async (dashboardId: string): Promise<void> => {
    await apiDelete(`/dashboards/${dashboardId}`);
  },

  /**
   * Создать дашборд из шаблона. Удобно для онбординга: сразу получаем
   * заполненный дашборд с готовыми виджетами проектной/командной
   * аналитики.
   */
  createDashboardFromTemplate: async (payload: {
    workspaceId: string;
    templateId: string;
    name?: string;
    description?: string;
  }): Promise<DashboardPayload> => {
    const res = await apiPost<BackendDashboard>("/dashboards/from-template", {
      workspace_id: payload.workspaceId,
      template_id: payload.templateId,
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.description ? { description: payload.description } : {}),
    });
    return mapDashboard(res.data);
  },

  /**
   * Получить список шаблонов дашбордов. Без `workspaceId` отдаёт только
   * системные шаблоны; с `workspaceId` — добавляет workspace-кастомные.
   */
  listDashboardTemplates: async (
    workspaceId?: string,
  ): Promise<DashboardTemplatePayload[]> => {
    const res = await apiGet<BackendDashboardTemplate[]>(
      "/dashboard-templates",
      workspaceId ? { workspace_id: workspaceId } : undefined,
    );
    return (res.data ?? []).map(mapDashboardTemplate);
  },

  /**
   * Выполнить ad-hoc аналитический запрос. Используется виджетами
   * для подтягивания данных.
   * Бэкенд: `POST /analytics/execute?workspace_id=<id>`.
   */
  executeAnalyticsQuery: async (
    workspaceId: string,
    query: AnalyticsQuery,
  ): Promise<AnalyticsResult> => {
    const res = await apiPost<BackendAnalyticsResult>(
      `/analytics/execute?workspace_id=${encodeURIComponent(workspaceId)}`,
      { query: analyticsQueryToRequest(query) },
    );
    return mapAnalyticsResult(res.data);
  },

  /**
   * Обновить имя/описание дашборда.
   * Бэкенд: `PATCH /dashboards/{id}` с `UpdateDashboardRequest`.
   */
  updateDashboard: async (
    dashboardId: string,
    payload: { name?: string; description?: string },
  ): Promise<DashboardPayload> => {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.description !== undefined) body.description = payload.description;
    const res = await apiPatch<BackendDashboard>(`/dashboards/${dashboardId}`, body);
    return mapDashboard(res.data);
  },

  /**
   * Пометить дашборд как default для workspace. На бэкенде у всех
   * остальных дашбордов того же workspace `is_default` сбрасывается.
   * Бэкенд: `POST /dashboards/{id}/default`.
   */
  setDefaultDashboard: async (dashboardId: string): Promise<void> => {
    await apiPost(`/dashboards/${dashboardId}/default`, {});
  },

  /**
   * Добавить виджет к дашборду. `query` опционален (например, для текстового
   * scorecard'а), но в большинстве случаев виджету нужен запрос.
   * Бэкенд: `POST /dashboards/{id}/widgets`.
   */
  addWidget: async (
    dashboardId: string,
    payload: {
      title: string;
      widgetType: WidgetType | string;
      query?: AnalyticsQuery;
      size?: { w: number; h: number };
      position?: { x: number; y: number };
      displayParams?: Record<string, unknown>;
    },
  ): Promise<AnalyticsWidget> => {
    const body: Record<string, unknown> = {
      title: payload.title,
      widget_type: payload.widgetType,
    };
    if (payload.query) body.query = analyticsQueryToRequest(payload.query);
    if (payload.size) body.size = payload.size;
    if (payload.position) body.position = payload.position;
    if (payload.displayParams) body.display_params = payload.displayParams;
    const res = await apiPost<BackendAnalyticsWidget>(
      `/dashboards/${dashboardId}/widgets`,
      body,
    );
    return mapAnalyticsWidget(res.data);
  },

  /**
   * Частичное обновление виджета. Любое поле опционально, но `null` не
   * принимается — отсутствие ключа = «не менять».
   * Бэкенд: `PATCH /dashboards/{id}/widgets/{widget_id}`.
   */
  updateWidget: async (
    dashboardId: string,
    widgetId: string,
    payload: {
      title?: string;
      query?: AnalyticsQuery;
      size?: { w: number; h: number };
      position?: { x: number; y: number };
      displayParams?: Record<string, unknown>;
    },
  ): Promise<AnalyticsWidget> => {
    const body: Record<string, unknown> = {};
    if (payload.title !== undefined) body.title = payload.title;
    if (payload.query !== undefined) body.query = analyticsQueryToRequest(payload.query);
    if (payload.size !== undefined) body.size = payload.size;
    if (payload.position !== undefined) body.position = payload.position;
    if (payload.displayParams !== undefined) body.display_params = payload.displayParams;
    const res = await apiPatch<BackendAnalyticsWidget>(
      `/dashboards/${dashboardId}/widgets/${widgetId}`,
      body,
    );
    return mapAnalyticsWidget(res.data);
  },

  /** Удалить виджет с дашборда. */
  removeWidget: async (dashboardId: string, widgetId: string): Promise<void> => {
    await apiDelete(`/dashboards/${dashboardId}/widgets/${widgetId}`);
  },

  /**
   * Массово обновить позиции/размеры виджетов (drag-n-drop layout).
   * Бэкенд: `PATCH /dashboards/{id}/layout`.
   */
  updateDashboardLayout: async (
    dashboardId: string,
    widgets: Array<{
      widgetId: string;
      position?: { x: number; y: number };
      size?: { w: number; h: number };
    }>,
  ): Promise<DashboardPayload> => {
    const body = {
      widgets: widgets.map((w) => ({
        widget_id: w.widgetId,
        ...(w.position ? { position: w.position } : {}),
        ...(w.size ? { size: w.size } : {}),
      })),
    };
    const res = await apiPatch<BackendDashboard>(
      `/dashboards/${dashboardId}/layout`,
      body,
    );
    return mapDashboard(res.data);
  },

  /**
   * Получить полный реестр аналитической схемы (data sources + поля +
   * допустимые агрегации). Кешируется один раз на сессию обычно.
   * Бэкенд: `GET /analytics/schema`.
   */
  getAnalyticsSchema: async (): Promise<AnalyticsSchemaPayload> => {
    type BackendSchema = {
      data_sources?: Array<{
        data_source: string;
        bounded_context: string;
        description?: string | null;
        fields?: Array<{
          name: string;
          type: string;
          description: string;
          filterable?: boolean;
          groupable?: boolean;
          sortable?: boolean;
          time_granularity_supported?: boolean;
          allowed_values?: string[] | null;
          notes?: string | null;
        }>;
        supported_aggregations?: string[];
        default_metrics?: Array<{ field?: string; aggregation?: string; alias?: string | null }>;
        notes?: string | null;
      }>;
      filter_operators?: string[];
      aggregations?: string[];
      time_granularities?: string[];
      sort_orders?: string[];
      widget_types?: string[];
    };
    const res = await apiGet<BackendSchema>("/analytics/schema");
    const raw = res.data ?? {};
    return {
      dataSources: (raw.data_sources ?? []).map((ds) => ({
        dataSource: ds.data_source,
        boundedContext: ds.bounded_context,
        description: ds.description ?? undefined,
        fields: (ds.fields ?? []).map((f) => ({
          name: f.name,
          type: f.type,
          description: f.description,
          filterable: f.filterable ?? true,
          groupable: f.groupable ?? false,
          sortable: f.sortable ?? false,
          timeGranularitySupported: f.time_granularity_supported ?? false,
          allowedValues: f.allowed_values ?? undefined,
          notes: f.notes ?? undefined,
        })),
        supportedAggregations: ds.supported_aggregations ?? [],
        defaultMetrics: (ds.default_metrics ?? []).map((m) => ({
          field: m.field ?? "*",
          aggregation: m.aggregation ?? "count",
          alias: m.alias ?? undefined,
        })),
        notes: ds.notes ?? undefined,
      })),
      filterOperators: raw.filter_operators ?? [],
      aggregations: raw.aggregations ?? [],
      timeGranularities: raw.time_granularities ?? [],
      sortOrders: raw.sort_orders ?? [],
      widgetTypes: raw.widget_types ?? [],
    };
  },
};

export { ApiError };
