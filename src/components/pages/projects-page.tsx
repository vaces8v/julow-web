"use client";

import { useEffect, useState } from "react";
import { Button, Input, Text } from "@heroui/react";
import {
  Add01Icon,
  ArrowUpRight01Icon,
  UserGroupIcon,
} from "hugeicons-react";
import Link from "next/link";
import { motion } from "motion/react";
import { Fade } from "@/components/ui/fade";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import { api, type ProjectPayload } from "@/lib/api";
import { useI18n } from "@/i18n/context";

const STATUS_BADGE: Record<string, { key: "statusActive" | "statusPaused" | "statusArchived" | "statusCompleted"; className: string }> = {
  active: { key: "statusActive", className: "bg-emerald-500/10 text-emerald-600" },
  paused: { key: "statusPaused", className: "bg-amber-500/10 text-amber-600" },
  archived: { key: "statusArchived", className: "bg-[var(--surface-secondary)] text-[var(--muted)]" },
  completed: { key: "statusCompleted", className: "bg-blue-500/10 text-blue-600" },
};

const FALLBACK_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#f97316", "#22c55e",
  "#ec4899", "#14b8a6", "#f59e0b", "#6366f1", "#ef4444",
];

function projectColor(project: ProjectPayload, idx: number) {
  if (project.color) return project.color;
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

export function ProjectsPage() {
  const { t } = useI18n();
  const copy = t.projects;
  const { activeWorkspaceId, refreshProjects } = useWorkspaceShell();
  const [projects, setProjects] = useState<ProjectPayload[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!activeWorkspaceId) return;
      const [projectList, allTasks] = await Promise.all([
        api.getProjects(activeWorkspaceId),
        api.getTasks(activeWorkspaceId),
      ]);
      if (cancelled) return;
      setProjects(projectList);

      const counts: Record<string, { total: number; done: number }> = {};
      for (const p of projectList) {
        counts[p.id] = { total: 0, done: 0 };
      }
      const isDone = (s: string) => {
        const l = s?.toLowerCase() ?? "";
        return l === "done" || l === "completed" || l === "closed";
      };
      for (const t of allTasks) {
        const entry = counts[t.projectId];
        if (entry) {
          entry.total++;
          if (isDone(t.status)) entry.done++;
        }
      }
      if (!cancelled) setTaskCounts(counts);
    };
    void run();
    return () => { cancelled = true; };
  }, [activeWorkspaceId, refreshKey]);

  const handleCreateProject = async () => {
    if (!activeWorkspaceId || !newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await api.createProject({
        workspaceId: activeWorkspaceId,
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      setNewName("");
      setNewDesc("");
      setDialogOpen(false);
      await refreshProjects();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to create project:", err);
      setCreateError(copy.createFailed);
    } finally {
      setCreating(false);
    }
  };

  const totalTasks = Object.values(taskCounts).reduce((s, c) => s + c.total, 0);
  const totalDone = Object.values(taskCounts).reduce((s, c) => s + c.done, 0);
  const summary = copy.summary
    .replace("{{projects}}", String(projects.length))
    .replace("{{done}}", String(totalDone))
    .replace("{{tasks}}", String(totalTasks));

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <Fade delay={0} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-tight">{copy.title}</h1>
          <Text variant="muted" className="m-0 mt-1 text-sm">
            {summary}
          </Text>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Add01Icon size={14} />
              {copy.newProject}
            </Button>
          </DialogTrigger>
          <DialogContent from="top">
            <DialogHeader>
              <DialogTitle>{copy.createTitle}</DialogTitle>
              <DialogDescription>{copy.createDesc}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">{copy.name}</label>
                <Input
                  fullWidth
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={copy.namePlaceholder}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">{copy.description}</label>
                <textarea
                  className="min-h-[80px] resize-none rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-accent/60 focus:outline-none transition-colors"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={copy.descriptionPlaceholder}
                />
              </div>
              {createError && (
                <Text className="m-0 text-sm text-danger">{createError}</Text>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary" size="sm">{t.common.cancel}</Button>
              </DialogClose>
              <Button size="sm" onPress={handleCreateProject} isDisabled={creating || !newName.trim()}>
                {creating ? copy.creating : copy.createProject}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Fade>

      {/* Project grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project, i) => {
          const counts = taskCounts[project.id] ?? { total: 0, done: 0 };
          const pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
          const badge = STATUS_BADGE[project.status] ?? STATUS_BADGE.active;
          const color = projectColor(project, i);
          const tasksLine = copy.tasksLine
            .replace("{{done}}", String(counts.done))
            .replace("{{total}}", String(counts.total));

          return (
            <Fade key={project.id} delay={i * 70} initialY={10}>
              <Link
                href={`/projects/${project.id}`}
                className="group block no-underline"
              >
                <div className="flex h-full flex-col rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border)] hover:shadow-md">
                  {/* Top row */}
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {project.icon ?? project.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="m-0 text-sm font-semibold">{project.name}</p>
                        <span className="text-[11px] text-[var(--muted)]">{project.methodology}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{copy[badge.key]}</span>
                      <ArrowUpRight01Icon size={14} strokeWidth={2} className="text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </div>

                  {/* Description */}
                  <Text variant="muted" className="m-0 mb-4 line-clamp-2 text-xs leading-relaxed">
                    {project.description ?? copy.noDescription}
                  </Text>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <Text variant="muted" className="m-0 text-[11px]">{tasksLine}</Text>
                      <span className="text-[11px] font-semibold" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.2 + i * 0.05 }}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-[var(--border)]/40">
                    <div className="flex items-center gap-1">
                      <UserGroupIcon size={12} strokeWidth={2} className="text-[var(--muted)]" />
                      <Text variant="muted" className="m-0 text-[11px]">{t.common.team}</Text>
                    </div>
                    <span className="text-[11px] font-medium" style={{ color }}>
                      {copy.openBoard}
                    </span>
                  </div>
                </div>
              </Link>
            </Fade>
          );
        })}

        {/* Add project placeholder */}
        <Fade delay={projects.length * 70} initialY={10}>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="flex min-h-[200px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)]/20 transition-colors hover:bg-[var(--surface-secondary)]/40"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-secondary)]">
              <Add01Icon size={18} strokeWidth={2} className="text-[var(--muted)]" />
            </div>
            <span className="text-sm font-medium text-[var(--muted)]">{copy.newProject}</span>
          </button>
        </Fade>
      </div>
    </div>
  );
}
