"use client";

/**
 * ProjectMembersDialog — модал управления участниками проекта.
 *
 * Видимость секций по правам:
 *   • Не-владелец: видит только список участников (read-only). Никаких
 *     селектов смены роли, кнопок удаления; вкладка «Приглашения» скрыта.
 *   • Владелец: full-access — смена ролей, удаление, отправка email-приглашений,
 *     генерация одноразовой ссылки/кода, отзыв активных приглашений.
 *
 * Ссылка/код — одно и то же значение токена. По умолчанию ссылка одноразовая
 * (`max_uses=1` на бэкенде). UI не показывает «макс. использований», чтобы
 * не загружать форму редко нужным параметром.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import {
  Add01Icon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Delete02Icon,
  Link01Icon,
  UserGroupIcon,
} from "hugeicons-react";

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
import { useAuth } from "@/components/auth/auth-context";
import {
  api,
  type ProjectInvitationPayload,
  type ProjectMemberPayload,
  type ProjectPayload,
  type ProjectRolePayload,
  type UserPayload,
} from "@/lib/api";

// ── Локальный i18n словарь ──

const COPY = {
  en: {
    title: "Project members",
    desc: "Manage who has access to this project and what they can do.",
    membersTab: "Members",
    invitesTab: "Invitations",
    inviteEmail: "Invite by email",
    inviteEmailPlaceholder: "user@example.com",
    inviteEmailSend: "Send",
    inviteEmailSending: "Sending…",
    inviteRole: "Role",
    inviteLinkTitle: "Invite via link or code",
    inviteLinkDesc: "Generate a one-time link or short code. Anyone who uses it joins with the chosen role.",
    inviteLinkGenerate: "Generate link",
    inviteLinkGenerating: "Generating…",
    inviteLinkExpiresInDays: "Expires in (days)",
    inviteLinkExpiresHint: "Leave empty to never expire.",
    copyLink: "Copy link",
    copyCode: "Copy code",
    copied: "Copied!",
    activeInvites: "Active invitations",
    noActiveInvites: "No pending invitations yet.",
    statusPending: "Pending",
    statusAccepted: "Accepted",
    statusDeclined: "Declined",
    statusExpired: "Expired",
    statusRevoked: "Revoked",
    revoke: "Revoke",
    membersTitle: "People in this project",
    you: "you",
    owner: "Owner",
    actionRemove: "Remove",
    confirmRemove: "Remove this member?",
    confirmRemoveDesc: "They will lose access to the project immediately. You can re-invite them later.",
    confirmRevoke: "Revoke this invitation?",
    confirmRevokeDesc: "The link or code will stop working. Anyone who hasn’t accepted it yet will be denied.",
    cancel: "Cancel",
    close: "Close",
    fieldRequired: "Required",
    invalidEmail: "Invalid email",
    noPermission: "Only project owners can manage members.",
    loading: "Loading…",
    errorGeneric: "Operation failed. Please try again.",
  },
  ru: {
    title: "Участники проекта",
    desc: "Управление доступом и правами в проекте.",
    membersTab: "Участники",
    invitesTab: "Приглашения",
    inviteEmail: "Пригласить по email",
    inviteEmailPlaceholder: "user@example.com",
    inviteEmailSend: "Отправить",
    inviteEmailSending: "Отправка…",
    inviteRole: "Роль",
    inviteLinkTitle: "Приглашение по ссылке/коду",
    inviteLinkDesc: "Создаст одноразовую ссылку или короткий код — присоединится один человек с выбранной ролью.",
    inviteLinkGenerate: "Сгенерировать",
    inviteLinkGenerating: "Создание…",
    inviteLinkExpiresInDays: "Истечёт через (дней)",
    inviteLinkExpiresHint: "Оставьте пустым, чтобы никогда не истекало.",
    copyLink: "Копировать ссылку",
    copyCode: "Копировать код",
    copied: "Скопировано!",
    activeInvites: "Активные приглашения",
    noActiveInvites: "Пока нет ожидающих приглашений.",
    statusPending: "Ожидает",
    statusAccepted: "Принято",
    statusDeclined: "Отклонено",
    statusExpired: "Истекло",
    statusRevoked: "Отозвано",
    revoke: "Отозвать",
    membersTitle: "Люди в проекте",
    you: "вы",
    owner: "Владелец",
    actionRemove: "Удалить",
    confirmRemove: "Удалить этого участника?",
    confirmRemoveDesc: "Он сразу потеряет доступ к проекту. Позже можно пригласить снова.",
    confirmRevoke: "Отозвать это приглашение?",
    confirmRevokeDesc: "Ссылка или код перестанут работать. Те, кто ещё не воспользовался ими, не смогут войти.",
    cancel: "Отмена",
    close: "Закрыть",
    fieldRequired: "Заполните поле",
    invalidEmail: "Некорректный email",
    noPermission: "Управлять участниками могут только владельцы проекта.",
    loading: "Загрузка…",
    errorGeneric: "Операция не удалась. Попробуйте ещё раз.",
  },
  de: {
    title: "Projektmitglieder",
    desc: "Verwalte Zugriff und Rechte für dieses Projekt.",
    membersTab: "Mitglieder",
    invitesTab: "Einladungen",
    inviteEmail: "Per E-Mail einladen",
    inviteEmailPlaceholder: "user@example.com",
    inviteEmailSend: "Senden",
    inviteEmailSending: "Sende…",
    inviteRole: "Rolle",
    inviteLinkTitle: "Einladung per Link/Code",
    inviteLinkDesc: "Erzeugt einen Einmal-Link oder Code — eine Person tritt mit der gewählten Rolle bei.",
    inviteLinkGenerate: "Generieren",
    inviteLinkGenerating: "Erzeuge…",
    inviteLinkExpiresInDays: "Läuft ab in (Tagen)",
    inviteLinkExpiresHint: "Leer lassen für keine Ablaufzeit.",
    copyLink: "Link kopieren",
    copyCode: "Code kopieren",
    copied: "Kopiert!",
    activeInvites: "Aktive Einladungen",
    noActiveInvites: "Noch keine offenen Einladungen.",
    statusPending: "Offen",
    statusAccepted: "Angenommen",
    statusDeclined: "Abgelehnt",
    statusExpired: "Abgelaufen",
    statusRevoked: "Widerrufen",
    revoke: "Widerrufen",
    membersTitle: "Personen im Projekt",
    you: "du",
    owner: "Eigentümer",
    actionRemove: "Entfernen",
    confirmRemove: "Dieses Mitglied entfernen?",
    confirmRemoveDesc: "Es verliert sofort den Zugriff auf das Projekt. Du kannst es später erneut einladen.",
    confirmRevoke: "Diese Einladung widerrufen?",
    confirmRevokeDesc: "Link oder Code funktionieren nicht mehr. Wer ihn noch nicht eingelöst hat, wird abgelehnt.",
    cancel: "Abbrechen",
    close: "Schließen",
    fieldRequired: "Erforderlich",
    invalidEmail: "Ungültige E-Mail",
    noPermission: "Nur Projekteigentümer können Mitglieder verwalten.",
    loading: "Lädt…",
    errorGeneric: "Aktion fehlgeschlagen. Bitte erneut versuchen.",
  },
} as const;

type CopyMap = (typeof COPY)[keyof typeof COPY];

// ── Хелперы ──

function readShortCode(token: string): string {
  return token.slice(0, 8).toUpperCase();
}

function plusDays(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString();
}

// ── Reusable native select (стиль матчит task-create-dialog) ──

function NativeSelect({
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...rest}
        className={`h-10 w-full cursor-pointer appearance-none rounded-xl border border-[var(--border)]/70 bg-[var(--surface)] pl-3 pr-9 text-[13px] outline-none transition-all focus:border-accent/70 focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10.5px] font-medium uppercase tracking-wide text-[var(--muted)]">
      {children}
    </label>
  );
}

// ── Props ──

export interface ProjectMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  project: ProjectPayload;
}

type Tab = "members" | "invitations";

export function ProjectMembersDialog({
  open,
  onOpenChange,
  workspaceId,
  project,
}: ProjectMembersDialogProps) {
  const { locale } = useI18n();
  const T = COPY[locale] ?? COPY.en;
  const { user } = useAuth();

  const isOwner = !!user && project.ownerIds.includes(user.id);

  const [tab, setTab] = useState<Tab>("members");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<ProjectMemberPayload[]>([]);
  const [roles, setRoles] = useState<ProjectRolePayload[]>([]);
  const [invitations, setInvitations] = useState<ProjectInvitationPayload[]>([]);
  const [userCache, setUserCache] = useState<Record<string, UserPayload>>({});

  // Link-приглашение (без max_uses в UI — всегда одноразовая)
  const [linkRoleId, setLinkRoleId] = useState("");
  const [linkExpiresDays, setLinkExpiresDays] = useState<string>("7");
  const [generatingLink, setGeneratingLink] = useState(false);

  // Скопировали — анимация
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  /**
   * Состояние диалога подтверждения деструктивных действий. Заменяет
   * `window.confirm` на полноценный модал поверх основного диалога —
   * выглядит частью UI, не блокирует JS-поток и согласован с темой.
   */
  type PendingAction =
    | { kind: "remove-member"; userId: string; label: string }
    | { kind: "revoke-invitation"; invitationId: string; label: string };
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Не-владельцу — всегда вкладка members; tab «invitations» скрыта.
  useEffect(() => {
    if (!isOwner && tab === "invitations") setTab("members");
  }, [isOwner, tab]);

  const defaultRole = useMemo(
    () =>
      roles.find((r) => r.name === "member") ??
      roles.find((r) => !r.isSystem) ??
      roles[0],
    [roles],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      // Загружаем members / roles / invitations НЕЗАВИСИМО. Раньше
      // использовался `Promise.all` — если у пользователя нет прав
      // `roles.read` (старые роли до миграции a1b2c3d4e5f6), весь
      // диалог падал с ошибкой «Недостаточно прав», и список
      // участников был НЕ виден, хотя `members.read` мог быть в порядке.
      //
      // Теперь:
      //   - members: жёсткое требование. Если не удалось — показываем ошибку.
      //   - roles: best-effort, без блокировки. Если не загрузились —
      //     роли просто не отобразятся в строке участника, всё остальное
      //     работает.
      //   - invitations: только для владельца, и так в try/catch.
      const [mRes, rRes, invRes] = await Promise.allSettled([
        api.getProjectMembers(workspaceId, project.id),
        api.getProjectRoles(workspaceId, project.id),
        isOwner
          ? api.getProjectInvitations(workspaceId, project.id)
          : Promise.resolve([] as ProjectInvitationPayload[]),
      ]);
      if (cancelled) return;

      if (mRes.status === "fulfilled") {
        setMembers(mRes.value);
      } else {
        console.error("Failed to load project members:", mRes.reason);
        setError(
          mRes.reason instanceof Error ? mRes.reason.message : T.errorGeneric,
        );
      }

      const r = rRes.status === "fulfilled" ? rRes.value : [];
      if (rRes.status === "rejected") {
        // Тихий warn — не блокируем UI.
        console.warn("Failed to load project roles (read-only fallback):", rRes.reason);
      }
      setRoles(r);

      setInvitations(invRes.status === "fulfilled" ? invRes.value : []);

      const def =
        r.find((x) => x.name === "member") ??
        r.find((x) => !x.isSystem) ??
        r[0];
      if (def) {
        setLinkRoleId((prev) => prev || def.id);
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, project.id, isOwner, T.errorGeneric]);

  const loadUser = useCallback(
    async (userId: string) => {
      if (userCache[userId]) return userCache[userId];
      try {
        const u = await api.getUserById(userId);
        setUserCache((prev) => ({ ...prev, [userId]: u }));
        return u;
      } catch {
        return null;
      }
    },
    [userCache],
  );

  useEffect(() => {
    if (!open) return;
    const ids = new Set<string>();
    for (const m of members) ids.add(m.userId);
    for (const id of ids) void loadUser(id);
  }, [open, members, loadUser]);

  const inviteUrl = (token: string) =>
    typeof window === "undefined"
      ? `/invite/${token}`
      : `${window.location.origin}/invite/${token}`;

  const copyToClipboard = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1500);
    } catch {
      // приватный режим / отключённый Clipboard API — silent ignore
    }
  };

  const handleGenerateLink = async () => {
    if (!linkRoleId) return;
    setGeneratingLink(true);
    try {
      const expires = linkExpiresDays.trim()
        ? plusDays(Number(linkExpiresDays))
        : undefined;
      // max_uses не передаём — backend ставит дефолт 1 (одноразовая ссылка)
      const inv = await api.generateProjectInvitationLink(workspaceId, project.id, {
        roleId: linkRoleId,
        expiresAt:
          expires && !Number.isNaN(new Date(expires).getTime()) ? expires : undefined,
      });
      setInvitations((prev) => [inv, ...prev]);
    } catch (e) {
      console.error("Failed to generate invite link:", e);
      setError(e instanceof Error ? e.message : T.errorGeneric);
    } finally {
      setGeneratingLink(false);
    }
  };

  /** Показать подтверждение перед отзывом — реальный API-вызов в `confirmPendingAction`. */
  const handleRevoke = (invitationId: string) => {
    const inv = invitations.find((i) => i.id === invitationId);
    const label = inv?.email ?? (inv?.link ? `Link · ${readShortCode(inv.link.value)}` : invitationId);
    setPendingAction({ kind: "revoke-invitation", invitationId, label });
  };

  const handleChangeRole = async (userId: string, newRoleId: string) => {
    try {
      await api.changeProjectMemberRole(workspaceId, project.id, userId, newRoleId);
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, roleId: newRoleId } : m)),
      );
    } catch (e) {
      console.error("Failed to change role:", e);
      setError(e instanceof Error ? e.message : T.errorGeneric);
    }
  };

  /** Показать подтверждение перед удалением — реальный API-вызов в `confirmPendingAction`. */
  const handleRemoveMember = (userId: string) => {
    const u = userCache[userId];
    const label = u?.email ?? userId;
    setPendingAction({ kind: "remove-member", userId, label });
  };

  /**
   * Выполнить отложенное деструктивное действие, выбранное в UI, после
   * того как пользователь нажал «Подтвердить» в ConfirmDialog. На любой
   * ошибке оставляем сам диалог открытым, чтобы пользователь увидел текст
   * ошибки и мог попробовать снова или закрыть.
   */
  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    setConfirming(true);
    try {
      if (pendingAction.kind === "remove-member") {
        await api.removeProjectMember(workspaceId, project.id, pendingAction.userId);
        setMembers((prev) => prev.filter((m) => m.userId !== pendingAction.userId));
      } else {
        await api.revokeProjectInvitation(workspaceId, project.id, pendingAction.invitationId);
        setInvitations((prev) =>
          prev.map((i) =>
            i.id === pendingAction.invitationId
              ? { ...i, status: "revoked" as const }
              : i,
          ),
        );
      }
      setPendingAction(null);
    } catch (e) {
      console.error("Confirm action failed:", e);
      setError(e instanceof Error ? e.message : T.errorGeneric);
    } finally {
      setConfirming(false);
    }
  };

  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  // ── Render ──

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserGroupIcon size={18} strokeWidth={1.8} />
            {T.title}
          </DialogTitle>
          <DialogDescription>{T.desc}</DialogDescription>
        </DialogHeader>

        {/* Tabs — вкладка «Приглашения» видна только владельцу. */}
        {isOwner ? (
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border)]/60 bg-[var(--surface-secondary)]/30 p-1">
            <button
              type="button"
              onClick={() => setTab("members")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                tab === "members"
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {T.membersTab} · {members.length}
            </button>
            <button
              type="button"
              onClick={() => setTab("invitations")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                tab === "invitations"
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {T.invitesTab} · {pendingInvitations.length}
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--surface-secondary)]/30 px-3 py-2 text-[12.5px] text-[var(--muted)]">
            {T.membersTab} · {members.length}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-[12px] text-red-600">
            <Alert02Icon size={14} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex h-32 items-center justify-center text-[12px] text-[var(--muted)]">
            {T.loading}
          </div>
        ) : tab === "members" || !isOwner ? (
          <MembersSection
            T={T}
            members={members}
            roles={roles}
            ownerIds={project.ownerIds}
            currentUserId={user?.id}
            isOwner={isOwner}
            userCache={userCache}
            onChangeRole={handleChangeRole}
            onRemove={handleRemoveMember}
          />
        ) : (
          <InvitationsSection
            T={T}
            roles={roles}
            invitations={invitations}
            linkRoleId={linkRoleId || defaultRole?.id || ""}
            setLinkRoleId={setLinkRoleId}
            linkExpiresDays={linkExpiresDays}
            setLinkExpiresDays={setLinkExpiresDays}
            generatingLink={generatingLink}
            onGenerateLink={handleGenerateLink}
            inviteUrl={inviteUrl}
            copiedKey={copiedKey}
            onCopy={copyToClipboard}
            onRevoke={handleRevoke}
          />
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button size="sm">
              {T.close}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>

      {/* Confirm dialog — вложенный, рендерится поверх основного.
          Открывается из `handleRevoke`/`handleRemoveMember`, реальный
          API-вызов идёт в `confirmPendingAction`. */}
      <ConfirmDialog
        open={!!pendingAction}
        onOpenChange={(v) => {
          if (!v && !confirming) setPendingAction(null);
        }}
        title={
          pendingAction?.kind === "remove-member" ? T.confirmRemove : T.confirmRevoke
        }
        description={
          pendingAction?.kind === "remove-member"
            ? T.confirmRemoveDesc
            : T.confirmRevokeDesc
        }
        target={pendingAction?.label ?? ""}
        confirmLabel={
          pendingAction?.kind === "remove-member" ? T.actionRemove : T.revoke
        }
        cancelLabel={T.cancel}
        loading={confirming}
        onConfirm={() => void confirmPendingAction()}
      />
    </Dialog>
  );
}

// ── Confirm dialog (destructive actions) ──

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  target,
  confirmLabel,
  cancelLabel,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Имя/email цели действия — рендерится отдельной строкой, чтобы пользователь видел кого именно удаляет. */
  target: string;
  confirmLabel: string;
  cancelLabel: string;
  loading: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[420px]"
        from="bottom"
        showClose={false}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <Alert02Icon size={14} strokeWidth={1.8} />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--surface-secondary)]/40 px-3 py-2 font-mono text-[12.5px]">
            {target}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button size="sm" isDisabled={loading}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            size="sm"
            onPress={onConfirm}
            isDisabled={loading}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Members panel ──

function MembersSection({
  T,
  members,
  roles,
  ownerIds,
  currentUserId,
  isOwner,
  userCache,
  onChangeRole,
  onRemove,
}: {
  T: CopyMap;
  members: ProjectMemberPayload[];
  roles: ProjectRolePayload[];
  ownerIds: string[];
  currentUserId?: string;
  isOwner: boolean;
  userCache: Record<string, UserPayload>;
  onChangeRole: (userId: string, newRoleId: string) => Promise<void>;
  /** Открывает ConfirmDialog в родителе; синхронно. Реальный вызов API — в confirmPendingAction. */
  onRemove: (userId: string) => void;
}) {
  return (
    <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
      {!isOwner && (
        <p className="rounded-xl border border-[var(--border)]/40 bg-[var(--surface-secondary)]/30 px-3 py-2 text-[11.5px] text-[var(--muted)]">
          {T.noPermission}
        </p>
      )}
      {members.length === 0 ? (
        <p className="text-[12px] text-[var(--muted)]">—</p>
      ) : (
        members.map((m) => {
          const isProjectOwner = ownerIds.includes(m.userId);
          const isMe = currentUserId === m.userId;
          const u = userCache[m.userId];
          const displayName = u?.email ?? m.userId;
          const role = roles.find((r) => r.id === m.roleId);
          // Право менять/удалять: только владелец, и нельзя трогать самого
          // себя и других владельцев.
          const canEdit = isOwner && !isProjectOwner && !isMe;
          return (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)]/50 bg-[var(--surface)] px-3 py-2.5 transition-colors hover:border-[var(--border)]"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold uppercase text-accent"
                  title={displayName}
                >
                  {(displayName ?? "?").slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium">{displayName}</span>
                    {isMe && (
                      <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                        {T.you}
                      </span>
                    )}
                    {isProjectOwner && (
                      <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                        {T.owner}
                      </span>
                    )}
                    {!m.isActive && (
                      <span className="rounded-md bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                        inactive
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canEdit ? (
                  /* Edit-режим: селект ролей + кнопка удалить (видны только владельцу) */
                  <>
                    <NativeSelect
                      value={m.roleId}
                      onChange={(e) => void onChangeRole(m.userId, e.target.value)}
                      className="!h-8 !text-[12px]"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </NativeSelect>
                    <button
                      type="button"
                      onClick={() => void onRemove(m.userId)}
                      title={T.actionRemove}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Delete02Icon size={14} strokeWidth={1.8} />
                    </button>
                  </>
                ) : (
                  /* Read-only режим: роль показана текстовым чипом, без действий */
                  <span className="rounded-md bg-[var(--surface-secondary)]/60 px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                    {role?.name ?? "—"}
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Invitations panel ──

function InvitationsSection({
  T,
  roles,
  invitations,
  linkRoleId,
  setLinkRoleId,
  linkExpiresDays,
  setLinkExpiresDays,
  generatingLink,
  onGenerateLink,
  inviteUrl,
  copiedKey,
  onCopy,
  onRevoke,
}: {
  T: CopyMap;
  roles: ProjectRolePayload[];
  invitations: ProjectInvitationPayload[];
  linkRoleId: string;
  setLinkRoleId: (v: string) => void;
  linkExpiresDays: string;
  setLinkExpiresDays: (v: string) => void;
  generatingLink: boolean;
  onGenerateLink: () => Promise<void>;
  inviteUrl: (token: string) => string;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => Promise<void>;
  /** Открывает ConfirmDialog в родителе; синхронно. Реальный вызов API — в confirmPendingAction. */
  onRevoke: (invitationId: string) => void;
}) {
  return (
    <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
      {/* ───── Link form (без max_uses — всегда одноразовая) ───── */}
      <section className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-secondary)]/20 p-4">
        <header className="mb-3 flex items-center gap-2">
          <Link01Icon size={14} strokeWidth={1.8} className="text-[var(--muted)]" />
          <h3 className="text-[13px] font-semibold">{T.inviteLinkTitle}</h3>
        </header>
        <p className="mb-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
          {T.inviteLinkDesc}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel>{T.inviteRole}</FieldLabel>
            <NativeSelect
              value={linkRoleId}
              onChange={(e) => setLinkRoleId(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>{T.inviteLinkExpiresInDays}</FieldLabel>
            <input
              type="number"
              min={1}
              value={linkExpiresDays}
              onChange={(e) => setLinkExpiresDays(e.target.value)}
              placeholder="7"
              className="h-10 w-full rounded-xl border border-[var(--border)]/70 bg-[var(--surface)] px-3.5 text-[13px] outline-none transition-all focus:border-accent/70 focus:ring-2 focus:ring-accent/15"
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-[var(--muted)]/80">{T.inviteLinkExpiresHint}</p>
        <div className="mt-4 flex justify-end">
          <Button size="md" onPress={() => void onGenerateLink()} isDisabled={generatingLink}>
            <Add01Icon size={14} strokeWidth={1.8} />
            {generatingLink ? T.inviteLinkGenerating : T.inviteLinkGenerate}
          </Button>
        </div>
      </section>

      {/* ───── Active invitations ───── */}
      <section>
        <h3 className="mb-2 text-[12.5px] font-semibold text-[var(--muted)] uppercase tracking-wide">
          {T.activeInvites}
        </h3>
        {/* Показываем только link-приглашения (email-приглашения скрыты) */}
        {invitations.filter((inv) => !inv.email).length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)]/60 px-3 py-4 text-center text-[12px] text-[var(--muted)]">
            {T.noActiveInvites}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {invitations.filter((inv) => !inv.email).map((inv) => {
              const role = roles.find((r) => r.id === inv.roleId);
              const isLink = !!inv.link;
              const statusLabel: Record<typeof inv.status, string> = {
                pending: T.statusPending,
                accepted: T.statusAccepted,
                declined: T.statusDeclined,
                expired: T.statusExpired,
                revoked: T.statusRevoked,
              };
              const statusCls: Record<typeof inv.status, string> = {
                pending: "bg-amber-500/10 text-amber-600",
                accepted: "bg-emerald-500/10 text-emerald-600",
                declined: "bg-red-500/10 text-red-500",
                expired: "bg-[var(--surface-secondary)] text-[var(--muted)]",
                revoked: "bg-[var(--surface-secondary)] text-[var(--muted)]",
              };
              const url = inv.link ? inviteUrl(inv.link.value) : "";
              const code = inv.link ? readShortCode(inv.link.value) : "";
              return (
                <li
                  key={inv.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)]/50 bg-[var(--surface)] p-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13px] font-medium">
                        {inv.email ?? (isLink ? `Link · ${code}` : inv.id)}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusCls[inv.status]}`}
                      >
                        {statusLabel[inv.status]}
                      </span>
                      {role && (
                        <span className="rounded-md bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                          {role.name}
                        </span>
                      )}
                    </div>
                    {isLink && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11.5px] text-[var(--muted)]">
                        <span className="truncate rounded-md bg-[var(--surface-secondary)]/60 px-1.5 py-0.5 font-mono max-w-full">
                          {url}
                        </span>
                        {inv.link?.expiresAt && (
                          <span>
                            · exp. {new Date(inv.link.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {isLink && inv.status === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => void onCopy(`url-${inv.id}`, url)}
                          title={T.copyLink}
                          className="flex h-7 items-center gap-1 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-secondary)]/40 px-2 text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                        >
                          {copiedKey === `url-${inv.id}` ? (
                            <>
                              <CheckmarkCircle02Icon size={12} /> {T.copied}
                            </>
                          ) : (
                            <>
                              <Copy01Icon size={12} /> {T.copyLink}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onCopy(`code-${inv.id}`, inv.link?.value ?? "")}
                          title={T.copyCode}
                          className="flex h-7 items-center gap-1 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-secondary)]/40 px-2 font-mono text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                        >
                          {copiedKey === `code-${inv.id}` ? T.copied : code}
                        </button>
                      </>
                    )}
                    {inv.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => void onRevoke(inv.id)}
                        title={T.revoke}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Delete02Icon size={13} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
