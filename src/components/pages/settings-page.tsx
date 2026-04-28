"use client";

import { useEffect, useMemo, useState } from "react";
import { useClickEffect } from "@/components/click-effect-context";
import { useI18n, type Locale } from "@/i18n/context";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import { api, type UserPayload, type WorkspaceMemberPayload } from "@/lib/api";
import { Button, Text } from "@heroui/react";
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
  GitBranchIcon,
  Key01Icon,
  Notification01Icon,
  Settings01Icon,
  ShieldKeyIcon,
  UserGroupIcon,
  UserCircleIcon,
} from "hugeicons-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

type Section =
  | "general"
  | "account"
  | "members"
  | "notifications"
  | "integrations"
  | "security"
  | "billing";

const NAV_ITEMS: { id: Section; labelKey: keyof ReturnType<typeof useI18n>["t"]["settings"]; icon: React.ElementType; badge?: string }[] = [
  { id: "general",       labelKey: "generalTitle",   icon: Settings01Icon },
  { id: "account",       labelKey: "accountTitle",   icon: UserCircleIcon },
  { id: "members",       labelKey: "membersTitle",   icon: UserGroupIcon },
  { id: "notifications", labelKey: "notifTitle",     icon: Notification01Icon, badge: "3" },
  { id: "integrations",  labelKey: "integrTitle",    icon: GitBranchIcon },
  { id: "security",      labelKey: "securityTitle",  icon: ShieldKeyIcon },
  { id: "billing", labelKey: "billingTitle", icon: CreditCardIcon },
];

/* ── Shared primitives ── */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="m-0 text-[12px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

function TextInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-9 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)]/60 focus:outline-none transition-colors ${props.className ?? ""}`}
    />
  );
}

function SelectInput({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }) {
  return (
    <select
      {...props}
      className={`h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus:border-[var(--accent)]/60 focus:outline-none transition-colors appearance-none cursor-pointer ${props.className ?? ""}`}
    >
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

function initialsFrom(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function SwitchRow({ label, description, defaultChecked = false }: { label: string; description?: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="m-0 text-sm font-medium">{label}</p>
        {description && <p className="m-0 mt-0.5 text-[12px] text-[var(--muted)]">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={setChecked} />
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      {description && (
        <Text variant="muted" className="m-0 mt-1 text-sm">{description}</Text>
      )}
    </div>
  );
}

/* ── Appearance subsection (inside General) ── */
function AppearanceSection() {
  const { enabled, setEnabled } = useClickEffect();
  const { t } = useI18n();
  const s = t.settings;
  return (
    <div className="space-y-5">
      <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{s.appearance}</p>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="m-0 text-sm font-medium">{s.clickRipple}</p>
          <p className="m-0 mt-0.5 text-[12px] text-[var(--muted)]">{s.clickRippleDesc}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
    </div>
  );
}

/* ── Section content ── */
function GeneralSection() {
  const { t, locale, setLocale } = useI18n();
  const s = t.settings;
  return (
    <div className="space-y-8">
      <SectionHeader title={s.generalTitle} description={s.generalDesc} />

      <div className="space-y-5">
        <Field label={s.workspaceName}>
          <TextInput defaultValue="Julow Platform" />
        </Field>
        <Field label={s.workspaceUrl} hint={s.workspaceUrlHint}>
          <div className="flex h-9 items-center overflow-hidden rounded-lg border border-[var(--border)] focus-within:border-[var(--accent)]/60 transition-colors">
            <span className="flex h-full items-center border-r border-[var(--border)] bg-[var(--surface-secondary)] px-3 text-sm text-[var(--muted)]">julow.io/</span>
            <input className="flex-1 bg-transparent px-3 text-sm focus:outline-none" defaultValue="julow-platform" />
          </div>
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label={s.timezone}>
            <SelectInput options={["UTC+3 (Moscow)", "UTC+0 (London)", "UTC-5 (New York)", "UTC+8 (Singapore)"]} />
          </Field>
          <Field label={s.language}>
            {/* Language selector — directly changes app locale */}
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
      </div>

      <Separator />

      <div className="space-y-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{s.prefs}</p>
        <SwitchRow label={s.publicWs}    description={s.publicWsDesc} />
        <SwitchRow label={s.guestAccess} description={s.guestAccessDesc} defaultChecked />
        <SwitchRow label={s.analytics}   description={s.analyticsDesc} defaultChecked />
      </div>

      <Separator />

      <AppearanceSection />

      <div className="flex items-center gap-2 pt-2">
        <Button size="sm">Save changes</Button>
        <Button size="sm" variant="secondary">Reset to defaults</Button>
      </div>
    </div>
  );
}

function AccountSection() {
  const [user, setUser] = useState<UserPayload | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.getMe()
      .then((payload) => {
        if (!cancelled) setUser(payload);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => { cancelled = true; };
  }, []);
  const displayName = user?.email.split("@")[0] ?? "—";
  const email = user?.email ?? "—";
  const [firstName, ...lastParts] = displayName.split(/[._-\s]+/).filter(Boolean);
  const lastName = lastParts.join(" ");
  return (
    <div className="space-y-8">
      <SectionHeader title="Account" description="Manage your personal profile and preferences." />

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15">
          <UserCircleIcon size={36} strokeWidth={1.5} className="text-accent" />
        </div>
        <div>
          <p className="m-0 font-semibold">{displayName}</p>
          <Text variant="muted" className="m-0 text-sm">{email}</Text>
          <Button size="sm" variant="secondary" className="mt-2">Change avatar</Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Profile</p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="First name"><TextInput key={`first-${user?.id ?? "empty"}`} defaultValue={firstName ?? ""} /></Field>
          <Field label="Last name"><TextInput key={`last-${user?.id ?? "empty"}`} defaultValue={lastName} /></Field>
        </div>
        <Field label="Email"><TextInput key={`email-${user?.id ?? "empty"}`} type="email" defaultValue={email === "—" ? "" : email} /></Field>
        <Field label="Role / Title"><TextInput key={`role-${user?.id ?? "empty"}`} defaultValue={user?.status ?? ""} /></Field>
      </div>

      <Separator />

      <div className="space-y-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Preferences</p>
        <SwitchRow label="Compact view" description="Reduce spacing in task lists and boards." />
        <SwitchRow label="Show task IDs" description="Display short IDs next to task titles." defaultChecked />
      </div>

      <div className="flex gap-2 pt-2">
        <Button size="sm">Save profile</Button>
      </div>
    </div>
  );
}

const ROLE_COLOR: Record<string, string> = {
  Owner: "bg-accent/10 text-accent",
  Admin: "bg-violet-500/10 text-violet-600",
  Member: "bg-emerald-500/10 text-emerald-600",
  Viewer: "bg-[var(--surface-secondary)] text-[var(--muted)]",
};

function MembersSection() {
  const { activeWorkspaceId } = useWorkspaceShell();
  const [members, setMembers] = useState<WorkspaceMemberPayload[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    api.getWorkspaceMembers(activeWorkspaceId)
      .then((payload) => {
        if (!cancelled) setMembers(payload);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => { cancelled = true; };
  }, [activeWorkspaceId]);
  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => {
      const name = member.displayName ?? member.userId;
      return name.toLowerCase().includes(q) || member.userId.toLowerCase().includes(q);
    });
  }, [members, query]);
  return (
    <div className="space-y-6">
      <SectionHeader title="Members" description="Manage who has access to this workspace." />

      <div className="flex items-center justify-between">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search members..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 w-56 rounded-lg border border-[var(--border)] bg-transparent pl-3 pr-3 text-sm placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)]/50 focus:outline-none transition-colors"
          />
        </div>
        <Button size="sm">
          <UserGroupIcon size={14} />
          Invite member
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)]/60">
        <div className="grid grid-cols-[1fr_100px_80px] gap-3 border-b border-[var(--border)]/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]/70">
          <span>Member</span>
          <span className="hidden sm:block">Role</span>
          <span />
        </div>
        {filteredMembers.map((m, i) => {
          const name = m.displayName ?? `User ${m.userId.slice(0, 8)}`;
          const role = m.roleId;
          return (
          <div
            key={m.id}
            className={`grid grid-cols-[1fr_100px_80px] items-center gap-3 px-4 py-3.5 ${i !== 0 ? "border-t border-[var(--border)]/40" : ""}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">{initialsFrom(name)}</div>
                {m.isActive && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-emerald-500" />}
              </div>
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-medium">{name}</p>
                <Text variant="muted" className="m-0 hidden text-xs sm:block">{m.userId}</Text>
              </div>
            </div>
            <span className={`hidden sm:inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_COLOR[role] ?? "bg-[var(--surface-secondary)] text-[var(--muted)]"}`}>{role.slice(0, 8)}</span>
            <div className="flex justify-end">
              {m.source !== "OWNER" && (
                <button type="button" className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-red-500/10 hover:text-red-500">
                  <Cancel01Icon size={13} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function NotificationsSection() {
  return (
    <div className="space-y-8">
      <SectionHeader title="Notifications" description="Choose how and when you receive updates." />

      <div className="space-y-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Email</p>
        <SwitchRow label="Daily digest" description="Summary of your tasks and team activity every morning." defaultChecked />
        <SwitchRow label="Task assignments" description="Notify when a task is assigned to you." defaultChecked />
        <SwitchRow label="Mentions" description="When someone @mentions you in a comment." defaultChecked />
        <SwitchRow label="Project updates" description="Sprint starts, completions, and milestone events." />
      </div>

      <Separator />

      <div className="space-y-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">In-app</p>
        <SwitchRow label="Real-time alerts" description="Instant bell icon notifications for critical updates." defaultChecked />
        <SwitchRow label="Comment replies" description="When someone replies to your comment thread." defaultChecked />
        <SwitchRow label="Status changes" description="Task moved to a different column or status." />
      </div>

      <Separator />

      <div className="space-y-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Integrations</p>
        <SwitchRow label="Slack" description="Post notifications to your configured Slack channel." defaultChecked />
        <SwitchRow label="Telegram" description="Receive critical alerts via Telegram bot." />
      </div>

      <div className="flex gap-2 pt-2">
        <Button size="sm">Save preferences</Button>
      </div>
    </div>
  );
}

const integrations = [
  { name: "GitHub", description: "Sync pull requests and commits to tasks.", connected: true, icon: "GH" },
  { name: "Slack", description: "Send notifications and updates to channels.", connected: true, icon: "SL" },
  { name: "Figma", description: "Embed design files directly in tasks.", connected: false, icon: "FG" },
  { name: "Jira", description: "Import and mirror issues from Jira boards.", connected: false, icon: "JR" },
  { name: "Google Calendar", description: "Sync task due dates with your calendar.", connected: true, icon: "GC" },
  { name: "Telegram", description: "Receive critical alerts via bot.", connected: false, icon: "TG" },
];

function IntegrationsSection() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Integrations" description="Connect Julow to the tools your team already uses." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {integrations.map((item) => (
          <div
            key={item.name}
            className="flex items-start gap-3 rounded-xl border border-[var(--border)]/60 p-4 transition-colors hover:bg-[var(--surface-secondary)]/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-secondary)] text-xs font-bold text-[var(--foreground)]">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="m-0 text-sm font-semibold">{item.name}</p>
                {item.connected && (
                  <CheckmarkCircle02Icon size={13} strokeWidth={2} className="text-emerald-500" />
                )}
              </div>
              <Text variant="muted" className="m-0 mt-0.5 text-[12px] leading-relaxed">{item.description}</Text>
            </div>
            <Button size="sm" variant={item.connected ? "secondary" : "primary"} className="shrink-0 mt-0.5">
              {item.connected ? "Disconnect" : "Connect"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecuritySection() {
  return (
    <div className="space-y-8">
      <SectionHeader title="Security" description="Protect your account and manage active sessions." />

      <div className="space-y-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Authentication</p>
        <SwitchRow label="Two-factor authentication" description="Require a verification code on every sign-in." defaultChecked />
        <SwitchRow label="Single sign-on (SSO)" description="Let team members sign in via your identity provider." />
        <SwitchRow label="Passwordless login" description="Use magic link email instead of a password." />
      </div>

      <Separator />

      <div className="space-y-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Password</p>
        <Field label="Current password">
          <TextInput type="password" placeholder="••••••••" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="New password">
            <TextInput type="password" placeholder="Min. 12 characters" />
          </Field>
          <Field label="Confirm new password">
            <TextInput type="password" placeholder="Repeat password" />
          </Field>
        </div>
        <Button size="sm" variant="secondary">
          <Key01Icon size={14} />
          Update password
        </Button>
      </div>

      <Separator />

      <div className="space-y-4">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Active sessions</p>
        {[
          { device: "Chrome · macOS Sequoia", location: "Moscow, Russia", current: true, time: "Now" },
          { device: "Safari · iPhone 16 Pro", location: "Moscow, Russia", current: false, time: "2h ago" },
          { device: "Firefox · Windows 11", location: "Saint-Petersburg, Russia", current: false, time: "5d ago" },
        ].map((session) => (
          <div key={session.device} className="flex items-center justify-between rounded-xl border border-[var(--border)]/60 px-4 py-3">
            <div>
              <p className="m-0 text-sm font-medium">{session.device}</p>
              <Text variant="muted" className="m-0 text-[11px]">{session.location} · {session.time}</Text>
            </div>
            {session.current ? (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600">Current</span>
            ) : (
              <Button size="sm" variant="secondary">Revoke</Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const PLAN_FEATURES = [
  "Unlimited projects",
  "Up to 25 team members",
  "Advanced analytics",
  "Priority support",
  "Custom integrations",
];

function BillingSection() {
  return (
    <div className="space-y-8">
      <SectionHeader title="Billing" description="Manage your subscription plan and payment details." />

      {/* Current plan */}
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="m-0 text-base font-bold">Pro Plan</p>
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">Active</span>
            </div>
            <Text variant="muted" className="m-0 mt-1 text-sm">$29 / month · Renews May 14, 2026</Text>
          </div>
          <Button size="sm" variant="secondary">Change plan</Button>
        </div>
        <Separator className="my-4 bg-accent/20" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PLAN_FEATURES.map((f) => (
            <div key={f} className="flex items-center gap-2">
              <CheckmarkCircle02Icon size={14} strokeWidth={2} className="shrink-0 text-accent" />
              <Text variant="muted" className="m-0 text-[12px]">{f}</Text>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Payment method</p>
        <div className="flex items-center justify-between rounded-xl border border-[var(--border)]/60 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-secondary)]">
              <CreditCardIcon size={18} strokeWidth={1.8} className="text-[var(--muted)]" />
            </div>
            <div>
              <p className="m-0 text-sm font-medium">•••• •••• •••• 4242</p>
              <Text variant="muted" className="m-0 text-[11px]">Visa · Expires 12/27</Text>
            </div>
          </div>
          <Button size="sm" variant="secondary">Update</Button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Recent invoices</p>
        {[
          { date: "Apr 14, 2026", amount: "$29.00", status: "Paid" },
          { date: "Mar 14, 2026", amount: "$29.00", status: "Paid" },
          { date: "Feb 14, 2026", amount: "$29.00", status: "Paid" },
        ].map((inv) => (
          <div key={inv.date} className="flex items-center justify-between rounded-lg border border-[var(--border)]/40 px-4 py-3">
            <Text variant="muted" className="m-0 text-sm">{inv.date}</Text>
            <span className="text-sm font-semibold">{inv.amount}</span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">{inv.status}</span>
              <Button size="sm" variant="secondary">PDF</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SECTION_CONTENT: Record<Section, React.ReactNode> = {
  general: <GeneralSection />,
  account: <AccountSection />,
  members: <MembersSection />,
  notifications: <NotificationsSection />,
  integrations: <IntegrationsSection />,
  security: <SecuritySection />,
  billing: <BillingSection />,
};

export function SettingsPage() {
  const [active, setActive] = useState<Section>("general");
  const { t } = useI18n();
  const s = t.settings;

  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="m-0 text-2xl font-bold tracking-tight">{s.title}</h1>
        <Text variant="muted" className="m-0 mt-1 text-sm">{s.subtitle}</Text>
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
                  onClick={() => setActive(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-accent/10 font-medium text-accent"
                      : "text-[var(--muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <item.icon size={16} strokeWidth={1.8} className="shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {item.badge && (
                    <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${isActive ? "bg-accent/20 text-accent" : "bg-[var(--surface-secondary)] text-[var(--muted)]"}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile tab strip */}
        <div className="sm:hidden w-full absolute top-0 left-0 flex overflow-x-auto border-b border-[var(--border)]/60 bg-[var(--surface)] px-2 py-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
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
