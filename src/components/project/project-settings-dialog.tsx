"use client";

/**
 * ProjectSettingsDialog — модал настроек проекта.
 *
 * Секции:
 *   1. «General» (только владельцу проекта) — редактирование имени и описания
 *      проекта через `api.updateProjectInfo`. Оптимистично не делаем — сохраняем по
 *      кнопке Save, при успехе вызываем `onUpdated`, который патчит локальный
 *      стейт родителя. Доступ определяется по вхождению `user.id` в `project.ownerIds`
 *      — создатель попадает туда автоматически на бэке.
 *   2. «Danger zone» — удаление через подтверждение ввода названия точь-в-точь
 *      (case-sensitive). После успеха навигируем на `/projects`. Под удалением
 *      понимается `api.requestProjectDeletion` (soft delete).
 */

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { Alert02Icon, CheckmarkCircle02Icon, Delete02Icon, Edit02Icon } from "hugeicons-react";
import { useRouter } from "next/navigation";

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
import { useWorkspaceShell } from "@/components/workspace-shell-context";
import { useAuth } from "@/components/auth/auth-context";
import { api, type ProjectPayload } from "@/lib/api";

export interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  project: ProjectPayload;
  /**
   * Применяется после успешного PATCH `name`/`description`. Родитель
   * использует это для локального обновления стейта без полного рефетча.
   */
  onUpdated?: (patch: Partial<Pick<ProjectPayload, "name" | "description">>) => void;
}

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  workspaceId,
  project,
  onUpdated,
}: ProjectSettingsDialogProps) {
  const { t } = useI18n();
  const copy = t.projects;
  const router = useRouter();
  const { deleteProject } = useWorkspaceShell();
  const { user } = useAuth();

  const projectId = project.id;
  const projectName = project.name;
  /**
   * «Создатель» на бэке превращается в «владельца» в `project.owner_ids`.
   * Редактировать name/description может только владелец.
   */
  const isOwner = !!user && project.ownerIds.includes(user.id);

  // General — локальная форма. Сбрасывается при открытии и смене проекта.
  const [nameInput, setNameInput] = useState(project.name);
  const [descInput, setDescInput] = useState(project.description ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  /**
   * Сброс формы только при открытии/закрытии — НЕ при изменении project.name/description.
   * Иначе после успешного PATCH родитель патчит project → этот эффект ререндерил бы и
   * сбрасывал `saveOk` мгновенно, вызывая «вспышку» статуса.
   */
  useEffect(() => {
    if (open) {
      setNameInput(project.name);
      setDescInput(project.description ?? "");
      setSaveError(null);
      setSaveOk(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * Авто-скрытие «Изменения сохранены» через 5s. AnimatePresence ниже плавно
   * фейдит. Cleanup отменяет таймер если пользователь начал новое сохранение
   * или закрыл диалог — иначе можем сбросить чужое состояние.
   */
  useEffect(() => {
    if (!saveOk) return;
    const id = window.setTimeout(() => setSaveOk(false), 5000);
    return () => window.clearTimeout(id);
  }, [saveOk]);

  const trimmedName = nameInput.trim();
  const trimmedDesc = descInput.trim();
  const nameChanged = trimmedName !== "" && trimmedName !== project.name;
  const descChanged = trimmedDesc !== (project.description ?? "").trim();
  const canSaveGeneral = isOwner && (nameChanged || descChanged) && !isSaving;

  const [confirmInput, setConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Точное совпадение с учётом регистра.
  const canDelete = confirmInput === projectName && !isDeleting;

  const handleClose = (next: boolean) => {
    if (isDeleting || isSaving) return;
    if (!next) {
      setConfirmInput("");
      setError(null);
      setSaveError(null);
      setSaveOk(false);
    }
    onOpenChange(next);
  };

  const handleSaveGeneral = async () => {
    if (!canSaveGeneral) return;
    setSaveError(null);
    setSaveOk(false);
    setIsSaving(true);
    try {
      const patch: Partial<Pick<ProjectPayload, "name" | "description">> = {};
      const payload: Parameters<typeof api.updateProjectInfo>[2] = {};
      if (nameChanged) {
        payload.name = trimmedName;
        patch.name = trimmedName;
      }
      if (descChanged) {
        payload.description = { content: trimmedDesc, format: "MARKDOWN" };
        patch.description = trimmedDesc || undefined;
      }
      await api.updateProjectInfo(workspaceId, projectId, payload);
      onUpdated?.(patch);
      setSaveOk(true);
    } catch (err) {
      console.error("Failed to update project info:", err);
      const msg = err instanceof Error && err.message ? err.message : copy.settingsGeneralSaveFailed;
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setError(null);
    setIsDeleting(true);
    try {
      await deleteProject(projectId);
      onOpenChange(false);
      // Редирект на страницу проектов после успешного удаления.
      router.push("/projects");
    } catch (err) {
      console.error("Failed to delete project:", err);
      const msg = err instanceof Error && err.message ? err.message : copy.settingsDeleteFailed;
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{copy.settings}</DialogTitle>
        </DialogHeader>

        {/* General — карточка с инпутами имени/описания.
            Инпуты disabled для не-владельца → читаемо, но без права правки. */}
        <section className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-secondary)]/20">
          <header className="flex items-center gap-3 px-5 pt-5 pb-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Edit02Icon size={17} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight">{copy.settingsGeneral}</h3>
              <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--muted)]">
                {isOwner ? copy.settingsGeneralDesc : copy.settingsGeneralReadOnly}
              </p>
            </div>
          </header>

          <div className="space-y-4 px-5 pb-5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                {copy.settingsName}
              </label>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={copy.settingsNamePlaceholder}
                disabled={!isOwner || isSaving}
                className="h-10 w-full rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]/60 px-3.5 text-[13px] outline-none transition-all placeholder:text-[var(--muted)]/60 hover:border-[var(--border)] focus:border-accent/70 focus:bg-[var(--surface)] focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                {copy.settingsDescription}
              </label>
              <textarea
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder={copy.settingsDescriptionPlaceholder}
                disabled={!isOwner || isSaving}
                rows={4}
                className="w-full resize-y rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]/60 px-3.5 py-2.5 text-[13px] leading-relaxed outline-none transition-all placeholder:text-[var(--muted)]/60 hover:border-[var(--border)] focus:border-accent/70 focus:bg-[var(--surface)] focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          {isOwner && (
            <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)]/50 bg-[var(--surface)]/40 px-5 py-3">
              {/* Статус-слот: фейдит между error / saved / idle.
                  AnimatePresence + mode="wait" даёт плавный crossfade. */}
              <div className="flex min-h-[1.25rem] items-center text-[11.5px]">
                <AnimatePresence mode="wait" initial={false}>
                  {saveError ? (
                    <motion.span
                      key="error"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-1.5 text-red-500"
                    >
                      <Alert02Icon size={13} strokeWidth={1.8} />
                      {saveError}
                    </motion.span>
                  ) : saveOk ? (
                    <motion.span
                      key="ok"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center gap-1.5 text-green-500"
                    >
                      <CheckmarkCircle02Icon size={13} strokeWidth={1.8} />
                      {copy.settingsGeneralSaved}
                    </motion.span>
                  ) : nameChanged || descChanged ? (
                    <motion.span
                      key="dirty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-[var(--muted)]/70"
                    >
                      {copy.settingsGeneralUnsaved}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>
              <Button
                size="sm"
                onPress={handleSaveGeneral}
                isDisabled={!canSaveGeneral}
              >
                {isSaving ? copy.settingsGeneralSaving : copy.settingsGeneralSave}
              </Button>
            </footer>
          )}
        </section>

        {/* Danger zone — такая же карточная структура, но с акцентным красным. */}
        <section className="mt-4 overflow-hidden rounded-2xl border border-red-500/30 bg-red-500/[0.04]">
          <header className="flex items-center gap-3 px-5 pt-5 pb-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <Delete02Icon size={17} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight text-red-500">
                {copy.settingsDanger}
              </h3>
              <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--muted)]">
                {copy.settingsDeleteTitle}
              </p>
            </div>
          </header>

          <div className="space-y-3 px-5 pb-5">
            <DialogDescription className="text-[12px] leading-relaxed text-[var(--muted)]">
              {copy.settingsDeleteDesc}
            </DialogDescription>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                {copy.settingsDeleteConfirmLabel}
              </label>
              <div className="rounded-lg border border-[var(--border)]/40 bg-[var(--surface)]/60 px-3 py-1.5 text-[12.5px] font-mono">
                {projectName}
              </div>
              <input
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={copy.settingsDeleteConfirmPlaceholder}
                disabled={isDeleting}
                autoFocus
                className="h-10 w-full rounded-xl border border-red-500/30 bg-[var(--surface)]/60 px-3.5 text-[13px] outline-none transition-all placeholder:text-[var(--muted)]/60 hover:border-red-500/50 focus:border-red-500/70 focus:bg-[var(--surface)] focus:ring-2 focus:ring-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {error && <p className="text-[11px] text-red-500">{error}</p>}
            </div>
          </div>
        </section>

        <DialogFooter>
          <DialogClose asChild>
            <Button size="sm" isDisabled={isDeleting}>
              {copy.settingsCancel}
            </Button>
          </DialogClose>
          <Button
            size="sm"
            onPress={handleDelete}
            isDisabled={!canDelete}
          >
            {isDeleting ? copy.settingsDeleteProcessing : copy.settingsDeleteButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
