"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Text } from "@heroui/react";
import {
  Settings01Icon,
  UserGroupIcon,
  UserCircleIcon,
} from "hugeicons-react";

import { useClickEffect } from "@/components/click-effect-context";
import { useI18n, type Locale } from "@/i18n/context";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import {
  api,
  type ProfilePayload,
  type SessionPayload,
  type UserPayload,
  type WorkspaceMemberPayload,
  type WorkspacePayload,
} from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Страница настроек.
 *
 * Архитектура: три секции, каждая обращается к реальному backend:
 *   - General  → PATCH /workspaces/{ws}            (имя/описание workspace)
 *   - Account  → GET /profile/me + PATCH /profile/me/personal-info (bio)
 *                + GET/DELETE /account/sessions (список и завершение сессий)
 *   - Members  → GET /workspaces/{ws}/members     (read-only список)
 *
 * Поддержка deep-link через ?tab=<section> — работает для router.push
 * из профиль-шторки в app-shell («Мой аккаунт» → ?tab=account).
 *
 * Раньше была вкладка Security с сменой пароля и списком сессий
 * — смена пароля временно убрана, сессии переехали в Account.
 */

type Section = "general" | "account" | "members";

const NAV_ITEMS: ReadonlyArray<{
  id: Section;
  labelKey: keyof ReturnType<typeof useI18n>["t"]["settings"];
  icon: React.ElementType;
}> = [
  { id: "general", labelKey: "generalTitle", icon: Settings01Icon },
  { id: "account", labelKey: "accountTitle", icon: UserCircleIcon },
  { id: "members", labelKey: "membersTitle", icon: UserGroupIcon },
];

/* ── Shared primitives ───────────────────────────────────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="m-0 text-[12px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-9 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)]/60 focus:outline-none transition-colors ${props.className ?? ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[88px] w-full resize-y rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)]/60 focus:outline-none transition-colors ${props.className ?? ""}`}
    />
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      {description && (
        <Text color="muted" className="m-0 mt-1 text-sm">{description}</Text>
      )}
    </div>
  );
}

function StatusLine({
  state,
  okText,
  errText,
}: {
  state: "idle" | "saving" | "ok" | "error";
  okText: string;
  errText: string;
}) {
  if (state === "idle") return null;
  if (state === "saving") return null;
  return (
    <p
      className={`m-0 text-xs ${
        state === "ok" ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {state === "ok" ? okText : errText}
    </p>
  );
}

function initialsFrom(value: string) {
  const parts = value.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

/* ── General section: workspace + appearance + locale ────────── */

function GeneralSection() {
  const { t, locale, setLocale } = useI18n();
  const s = t.settings;
  const { activeWorkspaceId, workspaces, refreshProjects } = useWorkspaceShell();
  const { enabled: rippleEnabled, setEnabled: setRippleEnabled } = useClickEffect();

  const activeWorkspace: WorkspacePayload | undefined = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId),
    [workspaces, activeWorkspaceId],
  );

  const [name, setName] = useState("");
  const [savingState, setSavingState] = useState<"idle" | "saving" | "ok" | "error">("idle");

  // Гидрация формы при смене активного workspace.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(activeWorkspace?.name ?? "");
    setSavingState("idle");
  }, [activeWorkspace?.id, activeWorkspace?.name]);

  const dirty =
    Boolean(activeWorkspace) &&
    name.trim() !== (activeWorkspace?.name ?? "") &&
    name.trim().length >= 3;

  const handleSave = async () => {
    if (!activeWorkspaceId || !dirty) return;
    setSavingState("saving");
    try {
      await api.updateWorkspaceInfo(activeWorkspaceId, {
        name: name.trim(),
      });
      // Бэкенд возвращает MessageResponse без свежего workspace, поэтому
      // обновление списка `workspaces` в контексте произойдёт при следующей
      // перезагрузке. `refreshProjects` ниже — лёгкий способ форсировать
      // обновление workspace-уровневых данных, не делая отдельного fetch.
      await refreshProjects();
      setSavingState("ok");
    } catch (err) {
      console.error("Failed to update workspace:", err);
      setSavingState("error");
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader title={s.generalTitle} description={s.generalDesc} />

      <div className="space-y-5">
        <Field label={s.workspaceName}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!activeWorkspaceId}
            minLength={3}
            maxLength={100}
          />
        </Field>
        <Field label={s.language}>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="h-9 w-full appearance-none cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus:border-[var(--accent)]/60 focus:outline-none transition-colors"
          >
            <option value="en">{s.langEn}</option>
            <option value="ru">{s.langRu}</option>
            <option value="de">{s.langDe}</option>
          </select>
        </Field>
      </div>

      <Separator />

      <div className="space-y-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {s.appearance}
        </p>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="m-0 text-sm font-medium">{s.clickRipple}</p>
            <p className="m-0 mt-0.5 text-[12px] text-[var(--muted)]">
              {s.clickRippleDesc}
            </p>
          </div>
          <Switch checked={rippleEnabled} onCheckedChange={setRippleEnabled} />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          size="sm"
          onPress={handleSave}
          isDisabled={!dirty || savingState === "saving"}
        >
          {savingState === "saving" ? s.saving : s.saveChanges}
        </Button>
        <StatusLine
          state={savingState}
          okText={s.saved}
          errText={s.saveFailed}
        />
      </div>
    </div>
  );
}

/* ── Account section: profile (bio) + active sessions ──────── */

function AccountSection() {
  const { t } = useI18n();
  const s = t.settings;
  const [user, setUser] = useState<UserPayload | null>(null);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [savingState, setSavingState] = useState<"idle" | "saving" | "ok" | "error">("idle");

  // ── Sessions ───────────────────────────────────────
  // Раньше список сессий жил в отдельной вкладке Security вместе с
  // формой смены пароля. Мы убрали вкладку и форму пароля пока нет
  // востребованности — но сессии всё равно нужны для безопасности
  // (возможность выйти с чужого устройства), поэтому переехали вниз
  // вкладки Account.
  const [sessions, setSessions] = useState<SessionPayload[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getMe().catch(() => null), api.getMyProfile().catch(() => null)])
      .then(([userPayload, profilePayload]) => {
        if (cancelled) return;
        setUser(userPayload);
        setProfile(profilePayload);
        setDisplayName(profilePayload?.displayName ?? "");
        setBio(profilePayload?.bio ?? "");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionsLoading(true);
    api.getActiveSessions()
      .then((list) => { if (!cancelled) setSessions(list); })
      .catch(() => { if (!cancelled) setSessions([]); })
      .finally(() => { if (!cancelled) setSessionsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const dirty = bio !== (profile?.bio ?? "") || displayName !== (profile?.displayName ?? "");

  const handleSave = async () => {
    if (!dirty) return;
    setSavingState("saving");
    try {
      // Бэкенд игнорирует undefined-поля, поэтому jobTitle не передаём —
      // UI больше это поле не показывает и разрешать его редактировать не нужно.
      await api.updatePersonalInfo({
        displayName: displayName !== (profile?.displayName ?? "") ? displayName : undefined,
        bio: bio !== (profile?.bio ?? "") ? bio : undefined,
      });
      const fresh = await api.getMyProfile().catch(() => profile);
      if (fresh) setProfile(fresh);
      setSavingState("ok");
    } catch (err) {
      console.error("Failed to update profile:", err);
      setSavingState("error");
    }
  };

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      await api.terminateSession(sessionId);
      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    } catch (err) {
      console.error("Failed to terminate session:", err);
    } finally {
      setRevokingId(null);
    }
  };

  const shownName = displayName.trim() || user?.email.split("@")[0] || "—";
  const initials = initialsFrom(shownName);

  return (
    <div className="space-y-8">
      <SectionHeader title={s.accountTitle} description={s.accountDesc} />

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-base font-semibold text-accent">
          {initials}
        </div>
        <div>
          <p className="m-0 font-semibold">{shownName}</p>
          <Text color="muted" className="m-0 text-sm">{user?.email ?? "—"}</Text>
        </div>
      </div>

      <Separator />

      <div className="space-y-5">
        <Field label={s.profileDisplayName ?? "Display name"} hint={s.profileDisplayNameHint ?? "Visible in meetings, chats, and projects"}>
          <TextInput
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={255}
            placeholder={user?.email.split("@")[0] ?? ""}
          />
        </Field>
        <Field label={s.profileEmail}>
          <TextInput value={user?.email ?? ""} readOnly disabled />
        </Field>
        <Field label={s.profileBio} hint={s.profileBioHint}>
          <TextArea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            placeholder={s.profileBioHint}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          size="sm"
          onPress={handleSave}
          isDisabled={!dirty || savingState === "saving"}
        >
          {savingState === "saving" ? s.saving : s.saveChanges}
        </Button>
        <StatusLine
          state={savingState}
          okText={s.saved}
          errText={s.saveFailed}
        />
      </div>

      <Separator />

      {/* Активные сессии — переехали из удалённой Security-вкладки. */}
      <div className="space-y-4">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {s.sessionsTitle}
        </p>
        {sessionsLoading && (
          <p className="m-0 text-sm text-[var(--muted)]">{t.common.loading}</p>
        )}
        {!sessionsLoading && sessions.length === 0 && (
          <p className="m-0 text-sm text-[var(--muted)]">{s.sessionsEmpty}</p>
        )}
        {!sessionsLoading && sessions.map((session) => {
          const device = session.deviceInfo?.trim() || s.sessionDeviceUnknown;
          const created = new Date(session.createdAt);
          const dateLabel = Number.isNaN(created.getTime())
            ? ""
            : created.toLocaleString();
          return (
            <div
              key={session.id}
              className="flex items-center justify-between rounded-xl border border-[var(--border)]/60 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-medium">{device}</p>
                <Text color="muted" className="m-0 text-[11px]">
                  {session.ipAddress} · {dateLabel}
                </Text>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => handleRevoke(session.id)}
                isDisabled={revokingId === session.id}
              >
                {revokingId === session.id
                  ? s.sessionRevoking
                  : s.sessionRevoke}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Members section: read-only list from backend ────────────── */

function MembersSection() {
  const { t } = useI18n();
  const s = t.settings;
  const { activeWorkspaceId } = useWorkspaceShell();
  const [members, setMembers] = useState<WorkspaceMemberPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api.getWorkspaceMembers(activeWorkspaceId)
      .then((payload) => {
        if (!cancelled) setMembers(payload);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeWorkspaceId]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = m.displayName ?? m.userId;
      return (
        name.toLowerCase().includes(q) ||
        m.userId.toLowerCase().includes(q)
      );
    });
  }, [members, query]);

  return (
    <div className="space-y-6">
      <SectionHeader title={s.membersTitle} description={s.membersDesc} />

      <div className="relative flex items-center">
        <input
          type="text"
          placeholder={s.membersSearch}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 w-full max-w-sm rounded-lg border border-[var(--border)] bg-transparent px-3 text-sm placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)]/50 focus:outline-none transition-colors"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)]/60">
        <div className="grid grid-cols-[1fr_120px] gap-3 border-b border-[var(--border)]/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]/70">
          <span>Member</span>
          <span>Role</span>
        </div>
        {loading && (
          <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            {t.common.loading}
          </div>
        )}
        {!loading && filteredMembers.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            {s.membersEmpty}
          </div>
        )}
        {!loading && filteredMembers.map((m) => {
          const name = m.displayName ?? m.userId;
          return (
            <div
              key={m.id}
              className="grid grid-cols-[1fr_120px] items-center gap-3 border-b border-[var(--border)]/40 px-4 py-3 last:border-b-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                  {initialsFrom(name)}
                </div>
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-medium">{name}</p>
                  <Text color="muted" className="m-0 truncate text-[11px]">
                    {m.userId}
                  </Text>
                </div>
              </div>
              <span className="text-[11px] text-[var(--muted)]">
                {m.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Page shell ──────────────────────────────────────────────── */

const SECTION_CONTENT: Record<Section, React.ReactNode> = {
  general: <GeneralSection />,
  account: <AccountSection />,
  members: <MembersSection />,
};

/** Допустимые значения ?tab=... — совпадают с id секций. */
const VALID_TABS: ReadonlySet<Section> = new Set(["general", "account", "members"]);

function parseTabParam(raw: string | null): Section | null {
  if (!raw) return null;
  return VALID_TABS.has(raw as Section) ? (raw as Section) : null;
}

export function SettingsPage() {
  const { t } = useI18n();
  const s = t.settings;
  // Deep-link: /settings?tab=account открывает вкладку Account.
  // Используется в app-shell, пункт «Мой аккаунт» в профиль-шторке.
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = parseTabParam(searchParams.get("tab")) ?? "general";
  const [active, setActive] = useState<Section>(initialTab);

  // Синхронизация state ← URL при внешней навигации (router.push из шторки).
  useEffect(() => {
    const tab = parseTabParam(searchParams.get("tab"));
    if (tab && tab !== active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Обратная синхронизация URL ← state при клике по табу.
  // replace вместо push, чтобы не плодить историю.
  const handleSetActive = (next: Section) => {
    setActive(next);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", next);
    router.replace(`/settings?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="m-0 text-2xl font-bold tracking-tight">{s.title}</h1>
        <Text color="muted" className="m-0 mt-1 text-sm">{s.subtitle}</Text>
      </div>

      <div className="flex min-h-[600px] overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]">
        {/* Left nav */}
        <aside className="w-[200px] shrink-0 border-r border-[var(--border)]/60 py-4 hidden sm:block">
          <nav className="grid gap-0.5 px-2">
            {NAV_ITEMS.map((item) => {
              const isActive = active === item.id;
              const label = s[item.labelKey] as string;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSetActive(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-accent/10 font-medium text-accent"
                      : "text-[var(--muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <item.icon size={16} strokeWidth={1.8} className="shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile tab strip */}
        <div className="sm:hidden flex w-full overflow-x-auto border-b border-[var(--border)]/60 bg-[var(--surface)] px-2 py-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSetActive(item.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                active === item.id
                  ? "bg-accent/10 text-accent"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {s[item.labelKey] as string}
            </button>
          ))}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="max-w-2xl px-8 py-8">
            {SECTION_CONTENT[active]}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
