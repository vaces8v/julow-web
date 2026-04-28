"use client";

import { motion } from "motion/react";
import {
  Calendar01Icon,
  DashboardCircleIcon,
  File02Icon,
  BubbleChatIcon,
  Folder02Icon,
  Task01Icon,
} from "hugeicons-react";

/* ─── In-app preview mockup ────────────────────────────────────────
 * Self-contained recreation of the Julow UI for the landing hero —
 * sidebar + kanban + stat chips.  Pure HTML/CSS so it scales
 * crisply under 3D transforms.
 * ──────────────────────────────────────────────────────────────── */

const COLS = [
  { name: "To do", tint: "oklch(68% 0.02 260)", items: [
    { t: "Auth refresh flow", tag: "API", color: "oklch(62% 0.19 253)" },
    { t: "Sprint planning doc", tag: "Docs", color: "oklch(68% 0.17 150)" },
  ]},
  { name: "In progress", tint: "oklch(68% 0.17 253)", items: [
    { t: "Onboarding redesign", tag: "Design", color: "oklch(62% 0.22 300)", progress: 0.65 },
    { t: "Analytics dashboard", tag: "Web", color: "oklch(62% 0.19 253)", progress: 0.32 },
    { t: "Billing hooks", tag: "API", color: "oklch(75% 0.16 72)", progress: 0.88 },
  ]},
  { name: "Done", tint: "oklch(72% 0.19 150)", items: [
    { t: "Dark theme polish", tag: "UI", color: "oklch(68% 0.17 150)" },
  ]},
];

export function ProductMock() {
  return (
    <div
      className="relative w-full rounded-3xl border border-[var(--border)]/70 bg-[var(--surface)]/95 shadow-2xl shadow-[oklch(55%_0.18_253_/_0.22)] backdrop-blur-xl"
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-[var(--border)]/60 bg-[var(--surface-secondary)]/40 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(65%_0.23_25)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(78%_0.16_72)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(73%_0.19_150)]" />
        <div className="mx-auto flex items-center gap-1.5 rounded-md border border-[var(--border)]/40 bg-[var(--surface)]/60 px-3 py-0.5 text-[10px] font-medium text-[var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[oklch(73%_0.19_150)]" />
          app.julow.com/workspace
        </div>
        <span className="w-8" />
      </div>

      <div className="flex min-h-[320px]">
        {/* Sidebar */}
        <aside className="hidden w-[168px] shrink-0 border-r border-[var(--border)]/60 bg-[var(--surface-secondary)]/30 p-3 md:block">
          <div className="mb-4 flex items-center gap-2 px-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[12px] font-bold text-accent-foreground">J</div>
            <span className="text-[13px] font-bold tracking-tight">Julow</span>
          </div>
          {[
            { I: DashboardCircleIcon, l: "Dashboard" },
            { I: Calendar01Icon, l: "Today", active: true },
            { I: Folder02Icon, l: "Projects" },
            { I: BubbleChatIcon, l: "Chats" },
            { I: File02Icon, l: "Docs" },
          ].map(({ I, l, active }) => (
            <div
              key={l}
              className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors ${active ? "bg-accent/12 text-accent" : "text-[var(--muted)] hover:bg-[var(--surface)]/60"}`}
            >
              <I size={14} strokeWidth={1.9} />
              {l}
            </div>
          ))}
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-4 py-2.5">
            <div>
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Sprint 14
              </p>
              <h3 className="m-0 text-sm font-bold tracking-tight">Julow Web App</h3>
            </div>
            <div className="flex items-center gap-2">
              {["MS", "DP", "AV"].map((a, i) => (
                <div
                  key={a}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-[var(--surface)]"
                  style={{
                    background: ["oklch(62% 0.22 300)", "oklch(70% 0.17 72)", "oklch(62% 0.19 253)"][i],
                    marginLeft: i === 0 ? 0 : -6,
                  }}
                >
                  {a}
                </div>
              ))}
            </div>
          </div>

          {/* Board */}
          <div className="grid flex-1 grid-cols-3 gap-2.5 p-3">
            {COLS.map((col, ci) => (
              <div key={col.name} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: col.tint }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    {col.name}
                  </span>
                  <span className="text-[10px] font-semibold text-[var(--muted)]/60">
                    {col.items.length}
                  </span>
                </div>
                {col.items.map((it, i) => (
                  <motion.div
                    key={it.t}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + ci * 0.08 + i * 0.05, duration: 0.45 }}
                    className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface)] p-2.5 shadow-sm"
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                        style={{ background: `color-mix(in oklch, ${it.color} 18%, transparent)`, color: it.color }}
                      >
                        {it.tag}
                      </span>
                    </div>
                    <p className="m-0 text-[12px] font-semibold leading-snug text-[var(--foreground)]">
                      {it.t}
                    </p>
                    {"progress" in it && typeof it.progress === "number" && (
                      <div className="mt-2 h-1 w-full rounded-full bg-[var(--border)]/50">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(it.progress as number) * 100}%` }}
                          transition={{ delay: 0.7 + ci * 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full rounded-full"
                          style={{ background: it.color }}
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating chat bubble (3D pop-out) */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.0, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute -bottom-6 -right-4 flex items-center gap-2.5 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] px-3.5 py-2.5 shadow-2xl"
        style={{ transform: "translateZ(40px)" }}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[oklch(62%_0.22_300)] text-[10px] font-bold text-white">
          MS
        </div>
        <div>
          <p className="m-0 text-[11px] font-semibold text-[var(--foreground)]">Marina</p>
          <p className="m-0 text-[10px] text-[var(--muted)]">Review ready — final pass 👀</p>
        </div>
      </motion.div>

      {/* Floating stat chip (3D pop-out) */}
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute -top-4 -left-3 flex items-center gap-2.5 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] px-3.5 py-2.5 shadow-2xl"
        style={{ transform: "translateZ(35px)" }}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[oklch(73%_0.19_150_/_0.15)] text-[oklch(50%_0.19_150)]">
          <Task01Icon size={14} strokeWidth={2} />
        </div>
        <div>
          <p className="m-0 text-[11px] font-semibold text-[var(--foreground)]">12 shipped</p>
          <p className="m-0 text-[10px] text-[var(--muted)]">this sprint</p>
        </div>
      </motion.div>
    </div>
  );
}
