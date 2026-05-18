"use client";

/**
 * TaskCreateDialog — модал создания задачи проекта.
 *
 * Покрывает все поля, поддерживаемые бэкендом (через `api.createTask`):
 *  - обязательные: `title`
 *  - базовые:      `task_type`, `priority`, `description` (+ format), `due_date`
 *  - дополнит.:    `start_date`, `assignees[]`, `labels[]`, `effort_estimate`,
 *                  `epic_id`, `sprint_id`, `parent_task_id`, `reporter_id`,
 *                  `watchers[]`
 *
 * Валидация:
 *  - `react-hook-form` + `zod` (через `@hookform/resolvers/zod`).
 *  - Заголовок: 1..500 (бэкенд)
 *  - effort.value > 0 при заданном unit, и наоборот
 *  - daterange: `start_date <= due_date`
 */

import { useEffect, useMemo, useState } from "react";
import { Button, Calendar, Chip, DatePicker, Input, TextArea } from "@heroui/react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarDate, parseDate } from "@internationalized/date";
import { Add01Icon, ArrowDown01Icon, Cancel01Icon } from "hugeicons-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/auth-context";
import { useI18n } from "@/i18n/context";
import {
  api,
  type EpicPayload,
  type SprintPayload,
  type TaskPayload,
  type WorkspaceMemberPayload,
} from "@/lib/api";

/* ── Backend enum constants ──────────────────────────────────────── */

const TASK_TYPES = ["TASK", "BUG", "FEATURE", "IMPROVEMENT", "SUBTASK"] as const;
const PRIORITIES = ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL", "URGENT"] as const;
const DESCRIPTION_FORMATS = ["PLAIN", "MARKDOWN", "HTML"] as const;
const EFFORT_UNITS = ["HOURS", "STORY_POINTS", "DAYS", "T_SHIRT"] as const;

type TaskType = (typeof TASK_TYPES)[number];
type EffortUnit = (typeof EFFORT_UNITS)[number];

/* ── Zod schema ──────────────────────────────────────────────────── */

const labelSchema = z.object({
  name: z.string().trim().min(1).max(64),
  color: z.string().optional(),
});

const baseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "required")
    .max(500, "max500"),
  taskType: z.enum(TASK_TYPES),
  priority: z.enum(PRIORITIES),
  description: z.string().max(20_000).optional().or(z.literal("")),
  descriptionFormat: z.enum(DESCRIPTION_FORMATS),
  startDate: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  assigneeIds: z.array(z.string()).default([]),
  watcherIds: z.array(z.string()).default([]),
  labels: z.array(labelSchema).default([]),
  epicId: z.string().optional().or(z.literal("")),
  sprintId: z.string().optional().or(z.literal("")),
  parentTaskId: z.string().optional().or(z.literal("")),
  reporterId: z.string().optional().or(z.literal("")),
  effortValue: z
    .union([
      z.string().refine(
        (s) => s === "" || (!isNaN(Number(s)) && Number(s) > 0),
        "positiveNumber",
      ),
      z.number().positive(),
    ])
    .optional(),
  effortUnit: z.enum(EFFORT_UNITS).optional(),
});

const formSchema = baseSchema
  .refine(
    (data) => {
      if (!data.startDate || !data.dueDate) return true;
      return new Date(data.startDate).getTime() <= new Date(data.dueDate).getTime();
    },
    { message: "dueBeforeStart", path: ["dueDate"] },
  )
  .refine(
    (data) => {
      const hasValue = data.effortValue != null && data.effortValue !== "";
      const hasUnit = data.effortUnit != null;
      // оба поля должны быть либо пусты, либо заполнены
      return hasValue === hasUnit;
    },
    { message: "effortPair", path: ["effortValue"] },
  );

type FormValues = z.infer<typeof formSchema>;

/* ── Defaults ────────────────────────────────────────────────────── */

const DEFAULTS: FormValues = {
  title: "",
  taskType: "TASK",
  priority: "MEDIUM",
  description: "",
  descriptionFormat: "MARKDOWN",
  startDate: "",
  dueDate: "",
  assigneeIds: [],
  watcherIds: [],
  labels: [],
  epicId: "",
  sprintId: "",
  parentTaskId: "",
  reporterId: "",
  effortValue: "",
  effortUnit: undefined,
};

/* ── Component ───────────────────────────────────────────────────── */

export interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId: string;
  /** Колбэк после успешного создания (для оптимистичного обновления UI). */
  onCreated?: (task: TaskPayload) => void;
  /** Дефолтный тип задачи (например, "SUBTASK" если открываем из родителя). */
  defaultTaskType?: TaskType;
  /** Привязка к родительской задаче (skip selection). */
  parentTaskId?: string;
  /** Привязка к эпику. */
  epicId?: string;
  /** Привязка к спринту. */
  sprintId?: string;
}

export function TaskCreateDialog({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  onCreated,
  defaultTaskType,
  parentTaskId,
  epicId,
  sprintId,
}: TaskCreateDialogProps) {
  const { t } = useI18n();
  const tt = t.taskCreate;
  const cmn = t.common;
  const projectsCopy = t.projects;
  const { user } = useAuth();

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberPayload[]>([]);
  const [epics, setEpics] = useState<EpicPayload[]>([]);
  const [sprints, setSprints] = useState<SprintPayload[]>([]);
  /**
   * Список задач проекта — нужен для селектора «Родительская задача».
   * Раньше тут был сырой `<Input>` под UUID, что было совершенно непонятно
   * пользователю. Теперь — обычный select по существующим задачам.
   * Параметр `parentTaskId` (если передан извне) исключаем из списка,
   * чтобы нельзя было сделать задачу родителем самой себя.
   */
  const [projectTasks, setProjectTasks] = useState<TaskPayload[]>([]);

  const initialDefaults: FormValues = useMemo(
    () => ({
      ...DEFAULTS,
      taskType: defaultTaskType ?? DEFAULTS.taskType,
      parentTaskId: parentTaskId ?? "",
      epicId: epicId ?? "",
      sprintId: sprintId ?? "",
    }),
    [defaultTaskType, parentTaskId, epicId, sprintId],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialDefaults,
    mode: "onSubmit",
  });

  // Сбрасываем форму при открытии (свежие defaults).
  useEffect(() => {
    if (open) {
      reset(initialDefaults);
      setSubmitError(null);
      setAdvancedOpen(false);
    }
  }, [open, initialDefaults, reset]);

  /**
   * Загружаем справочники (МЕМБЕРЫ ПРОЕКТА / epics / sprints / project tasks).
   *
   * Раньше брали `api.getWorkspaceMembers(workspaceId)` — но это:
   *   1) не работало для приглашённых guest'ов, у которых нет
   *      `workspace.members.read` (бэкенд возвращал пусто → UI говорил
   *      «в workspace пока нет участников»);
   *   2) семантически неверно: исполнителем задачи может быть только
   *      участник КОНКРЕТНОГО проекта, а не всего workspace.
   *
   * Теперь берём `api.getProjectMembers(workspaceId, projectId)` —
   * это правильный источник, и после миграции `a1b2c3d4e5f6` право
   * `members.read` есть у всех ролей (включая guest).
   *
   * Поскольку `ProjectMemberPayload` не содержит email/имени,
   * параллельно подтягиваем `getUserById` для каждого участника, чтобы
   * показать читаемое имя в чипе пикера, а не UUID-обрезок.
   */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const [pm, e, s, tasks] = await Promise.all([
          api.getProjectMembers(workspaceId, projectId).catch(() => []),
          api.getEpics(workspaceId, projectId).catch(() => [] as EpicPayload[]),
          api.getSprints(workspaceId, projectId).catch(() => [] as SprintPayload[]),
          api.getProjectTasks(workspaceId, projectId).catch(() => [] as TaskPayload[]),
        ]);
        if (cancelled) return;

        // Подтягиваем email'ы участников параллельно. Любая ошибка
        // конкретного пользователя — не критична, просто `displayName`
        // останется undefined, и `memberLabel` упадёт на стандартный
        // fallback (короткий UUID).
        const userEntries = await Promise.all(
          pm.map(async (m) => {
            try {
              const u = await api.getUserById(m.userId);
              return [m.userId, u] as const;
            } catch {
              return [m.userId, null] as const;
            }
          }),
        );
        if (cancelled) return;
        const userByid = new Map(userEntries);

        // Мапим ProjectMemberPayload → WorkspaceMemberPayload-совместимый
        // shape (тот же набор полей, которые читает `MemberPicker` /
        // `memberLabel`). Так не нужно ломать сигнатуру компонента,
        // достаточно подменить источник данных.
        const mapped: WorkspaceMemberPayload[] = pm.map((m) => {
          const u = userByid.get(m.userId);
          const displayName = u?.email ? u.email.split("@")[0] : undefined;
          return {
            id: m.id,
            userId: m.userId,
            displayName,
            roleId: m.roleId,
            joinedAt: m.joinedAt ?? "",
            isActive: m.isActive,
            source: "project",
          };
        });

        setMembers(mapped);
        setEpics(e);
        setSprints(s);
        setProjectTasks(tasks);
      } catch (err) {
        if (!cancelled) console.error("Failed to load task-create refs:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, projectId]);

  const labelsField = useFieldArray({ control, name: "labels" });
  const [labelDraft, setLabelDraft] = useState("");

  const addLabel = () => {
    const name = labelDraft.trim();
    if (!name) return;
    if (labelsField.fields.some((f) => f.name === name)) {
      setLabelDraft("");
      return;
    }
    labelsField.append({ name });
    setLabelDraft("");
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const payload = {
        workspaceId,
        projectId,
        title: values.title.trim(),
        taskType: values.taskType,
        priority: values.priority,
        description: values.description?.trim() || undefined,
        descriptionFormat: values.description?.trim() ? values.descriptionFormat : undefined,
        startDate: values.startDate || undefined,
        dueDate: values.dueDate || undefined,
        assigneeIds: values.assigneeIds.length > 0 ? values.assigneeIds : undefined,
        watcherIds: values.watcherIds.length > 0 ? values.watcherIds : undefined,
        labels: values.labels.length > 0 ? values.labels : undefined,
        epicId: values.epicId || undefined,
        sprintId: values.sprintId || undefined,
        parentTaskId: values.parentTaskId || undefined,
        reporterId: values.reporterId || undefined,
        effortEstimate:
          values.effortValue && values.effortUnit
            ? { value: Number(values.effortValue), unit: values.effortUnit }
            : undefined,
      } as const;

      const task = await api.createTask(payload);
      onCreated?.(task);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg || tt.errorGeneric);
    }
  });

  /* ── i18n-friendly error helper ── */
  const errorText = (key: string | undefined): string | undefined => {
    if (!key) return undefined;
    const map: Record<string, string> = {
      required: tt.errorRequired,
      max500: tt.errorMax500,
      positiveNumber: tt.errorPositive,
      dueBeforeStart: tt.errorDueBeforeStart,
      effortPair: tt.errorEffortPair,
    };
    return map[key] ?? key;
  };

  /**
   * Понятная подпись участника. Бэкенд может не вернуть `display_name`
   * (только что зарегистрированные аккаунты, OAuth без профиля и т.п.).
   * Раньше в этом случае мы показывали обрезанный UUID типа `5d9e354f`,
   * из-за чего юзер в одиночном workspace видел «Наблюдатели · 5d9e354f»
   * и не понимал, что это его собственный аккаунт.
   *
   * Новая логика:
   *  1) если это текущий пользователь — показываем префикс его email
   *     («john» вместо «john@acme.io») и помечаем плашкой «вы»;
   *  2) если у участника есть display_name — берём его;
   *  3) фоллбэк — «Участник • XXXXXXXX» (с явным префиксом, чтобы было
   *     ясно: это не имя, а технический идентификатор).
   */
  const memberLabel = (m: WorkspaceMemberPayload): string => {
    if (user && m.userId === user.id) {
      return user.email.split("@")[0] || user.email;
    }
    const dn = m.displayName?.trim();
    if (dn) return dn;
    // Fallback при отсутствии display_name и не-текущем юзере. Префикс
    // «Member •» делает явным, что это технический идентификатор, а не имя.
    return `Member • ${m.userId.slice(0, 8)}`;
  };
  const isCurrentUser = (m: WorkspaceMemberPayload) => !!user && m.userId === user.id;

  const watchedAssignees = watch("assigneeIds");
  const watchedWatchers = watch("watcherIds");

  const toggleArrayField = (
    field: "assigneeIds" | "watcherIds",
    userId: string,
  ) => {
    const current = (field === "assigneeIds" ? watchedAssignees : watchedWatchers) ?? [];
    const next = current.includes(userId)
      ? current.filter((x) => x !== userId)
      : [...current, userId];
    setValue(field, next, { shouldDirty: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        from="top"
        className="max-h-[90vh] w-[min(640px,calc(100vw-32px))] max-w-[640px] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{tt.title}</DialogTitle>
          <DialogDescription>{tt.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4 py-1">
          {/* Title (required) */}
          <Field
            label={tt.fieldTitle}
            required
            error={errorText(errors.title?.message as string | undefined)}
          >
            <Input
              fullWidth
              autoFocus
              placeholder={tt.fieldTitlePlaceholder}
              aria-invalid={errors.title != null}
              {...register("title")}
            />
          </Field>

          {/* Type + Priority */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={tt.fieldType}>
              <NativeSelect {...register("taskType")}>
                {TASK_TYPES.map((tp) => (
                  <option key={tp} value={tp}>
                    {tt.taskType[tp]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={tt.fieldPriority}>
              <NativeSelect {...register("priority")}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {tt.priority[p]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          {/* Description */}
          <Field
            label={tt.fieldDescription}
            error={errorText(errors.description?.message as string | undefined)}
          >
            <TextArea
              rows={4}
              placeholder={tt.fieldDescriptionPlaceholder}
              className="min-h-[100px] w-full resize-y rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm placeholder:text-muted/50 focus:border-(--accent)/60 focus:outline-none"
              {...register("description")}
            />
          </Field>

          {/* Dates — HeroUI DatePicker через Controller. В форме храним
            *   ISO YYYY-MM-DD (как раньше); конвертация туда/обратно
            *   делается в `value`/`onChange`. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={tt.fieldStartDate}>
              <Controller
                control={control}
                name="startDate"
                render={({ field }) => (
                  <DateField
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={tt.fieldStartDate}
                  />
                )}
              />
            </Field>
            <Field
              label={tt.fieldDueDate}
              error={errorText(errors.dueDate?.message as string | undefined)}
            >
              <Controller
                control={control}
                name="dueDate"
                render={({ field }) => (
                  <DateField
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={tt.fieldDueDate}
                  />
                )}
              />
            </Field>
          </div>

          {/* Assignees — пикер чипов; передаём labeller/детектор «это вы»,
            *   чтобы в чипах вместо «5d9e354f» рисовался email-префикс
            *   текущего юзера + плашка «вы». */}
          <Field label={tt.fieldAssignees} hint={tt.fieldAssigneesHint}>
            <MemberPicker
              members={members}
              value={watchedAssignees ?? []}
              onToggle={(uid) => toggleArrayField("assigneeIds", uid)}
              emptyLabel={tt.noMembers}
              memberLabel={memberLabel}
              isCurrentUser={isCurrentUser}
              youBadge={tt.youBadge}
            />
          </Field>

          {/* Labels */}
          <Field label={tt.fieldLabels} hint={tt.fieldLabelsHint}>
            <div className="flex flex-wrap gap-1.5">
              {labelsField.fields.map((f, idx) => (
                <Chip
                  key={f.id}
                  size="sm"
                  variant="soft"
                  color="accent"
                  className="gap-1"
                >
                  <span>{f.name}</span>
                  <button
                    type="button"
                    onClick={() => labelsField.remove(idx)}
                    className="ml-1 inline-flex items-center"
                    aria-label={cmn.cancel}
                  >
                    <Cancel01Icon size={12} strokeWidth={2.4} />
                  </button>
                </Chip>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input
                fullWidth
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLabel();
                  }
                }}
                placeholder={tt.fieldLabelsPlaceholder}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onPress={addLabel}
                isDisabled={!labelDraft.trim()}
              >
                <Add01Icon size={14} />
              </Button>
            </div>
          </Field>

          {/* Advanced section toggle */}
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex items-center gap-1.5 self-start text-xs font-medium text-accent hover:underline"
            aria-expanded={advancedOpen}
          >
            <ArrowDown01Icon
              size={14}
              strokeWidth={2}
              className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
            {advancedOpen ? tt.hideAdvanced : tt.showAdvanced}
          </button>

          {advancedOpen && (
            <div className="grid gap-4 rounded-xl border border-(--border)/60 bg-(--surface-secondary)/30 p-4">
              {/* Description format */}
              <Field label={tt.fieldDescriptionFormat}>
                <NativeSelect {...register("descriptionFormat")}>
                  {DESCRIPTION_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {tt.descriptionFormat[f]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              {/* Effort estimate.
                *
                * Раньше placeholder поля значения был "0", и пользователь думал,
                * что в поле уже стоит 0 и оценка задана. Меняем на пример
                * («e.g. 4» / «напр. 4» / «z. B. 4») — сразу понятно, что нужно
                * вписать своё число. Лейбл единицы измерения тоже сделан явным:
                * по умолчанию выбран "Без единицы" / "No unit", а не загадочное
                * "Выберите единицу…", которое не было видно как состояние. */}
              <Field
                label={tt.fieldEffortEstimate}
                hint={tt.fieldEffortHint}
                error={errorText(errors.effortValue?.message as string | undefined)}
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px]">
                  <Input
                    fullWidth
                    type="number"
                    min={0}
                    step="0.5"
                    placeholder={tt.fieldEffortValuePlaceholder}
                    {...register("effortValue")}
                  />
                  <Controller
                    control={control}
                    name="effortUnit"
                    render={({ field }) => (
                      <NativeSelect
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? undefined : (e.target.value as EffortUnit),
                          )
                        }
                      >
                        <option value="">{tt.effortNoUnit}</option>
                        {EFFORT_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {tt.effortUnit[u]}
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                  />
                </div>
              </Field>

              {/* Epic — empty-state с дизейблом + понятным hint'ом вместо
                * безмолвного "Не выбрано", когда список реально пуст. */}
              {!epicId && (
                <Field
                  label={tt.fieldEpic}
                  hint={epics.length === 0 ? tt.fieldEpicNone : undefined}
                >
                  <NativeSelect
                    {...register("epicId")}
                    disabled={epics.length === 0}
                  >
                    <option value="">{tt.notSelected}</option>
                    {epics.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}

              {/* Sprint — аналогичный empty-state. */}
              {!sprintId && (
                <Field
                  label={tt.fieldSprint}
                  hint={sprints.length === 0 ? tt.fieldSprintNone : undefined}
                >
                  <NativeSelect
                    {...register("sprintId")}
                    disabled={sprints.length === 0}
                  >
                    <option value="">{tt.notSelected}</option>
                    {sprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}

              {/* Parent task — селект по существующим задачам проекта.
                *
                * Раньше тут был `<Input>` с плейсхолдером "UUID родительской
                * задачи" — никто не знает UUID наизусть, поле было фактически
                * бесполезным. Теперь — обычный select, исключая саму себя
                * (если редактируем под существующего родителя — поле скрыто
                * через `parentTaskId` prop). При пустом списке селект
                * дизейблится с понятным сообщением. */}
              {!parentTaskId && (() => {
                const parentOptions = projectTasks;
                return (
                  <Field
                    label={tt.fieldParentTask}
                    hint={
                      parentOptions.length === 0
                        ? tt.fieldParentTaskNone
                        : tt.fieldParentTaskHint
                    }
                  >
                    <NativeSelect
                      {...register("parentTaskId")}
                      disabled={parentOptions.length === 0}
                    >
                      <option value="">{tt.notSelected}</option>
                      {parentOptions.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                );
              })()}

              {/* Reporter override — `memberLabel` теперь распознаёт текущего
                * юзера и подставляет его email-префикс + плашку «вы», вместо
                * обрезанного UUID, который пугал в одиночных workspace'ах. */}
              <Field label={tt.fieldReporter} hint={tt.fieldReporterHint}>
                <NativeSelect {...register("reporterId")}>
                  <option value="">{tt.reporterMe}</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {isCurrentUser(m)
                        ? `${memberLabel(m)} (${tt.youBadge})`
                        : memberLabel(m)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              {/* Watchers */}
              <Field label={tt.fieldWatchers} hint={tt.fieldWatchersHint}>
                <MemberPicker
                  members={members}
                  value={watchedWatchers ?? []}
                  onToggle={(uid) => toggleArrayField("watcherIds", uid)}
                  emptyLabel={tt.noMembers}
                  memberLabel={memberLabel}
                  isCurrentUser={isCurrentUser}
                  youBadge={tt.youBadge}
                />
              </Field>
            </div>
          )}

          {submitError && (
            <p className="m-0 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {submitError}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                isDisabled={isSubmitting}
              >
                {cmn.cancel}
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" isDisabled={isSubmitting}>
              {isSubmitting ? tt.submitting : projectsCopy.createTask}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

/**
 * DateField — обёртка над HeroUI DatePicker, работающая со строковым
 * ISO-значением (`YYYY-MM-DD`), которое хранит form. Внутри конвертит
 * в `CalendarDate` (тип, который нужен HeroUI).
 */
function DateField({
  value,
  onChange,
  placeholder,
}: {
  value: string | undefined;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const parsed: CalendarDate | null = (() => {
    if (!value) return null;
    try {
      return parseDate(value.slice(0, 10));
    } catch {
      return null;
    }
  })();

  return (
    <DatePicker
      value={parsed}
      onChange={(d: CalendarDate | null) => onChange(d ? d.toString() : "")}
    >
      <DatePicker.Trigger className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-(--border)/60 bg-transparent px-3 text-sm text-foreground outline-none transition-colors hover:bg-(--surface-secondary)/40 focus-visible:border-accent/60">
        <span className="min-w-0 flex-1 truncate text-left">
          {parsed ? parsed.toString() : (placeholder ?? "—")}
        </span>
        <DatePicker.TriggerIndicator />
      </DatePicker.Trigger>
      <DatePicker.Popover>
        <Calendar />
      </DatePicker.Popover>
    </DatePicker>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="flex items-center gap-1 text-sm font-medium">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="m-0 text-[11px] text-red-500">{error}</p>
      ) : hint ? (
        <p className="m-0 text-[11px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const NativeSelect = ({
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...rest}
    className={`h-9 cursor-pointer appearance-none rounded-lg border border-(--border) bg-(--surface) px-3 text-sm transition-colors focus:border-(--accent)/60 focus:outline-none ${className}`.trim()}
  >
    {children}
  </select>
);
NativeSelect.displayName = "NativeSelect";

/**
 * Чип-пикер участников. Принимает `memberLabel` и `isCurrentUser` извне,
 * потому что эта логика зависит от текущего пользователя (`useAuth`), а
 * хук должен жить в основном компоненте, а не в этом презентационном
 * хелпере.
 *
 * Раньше тут было `m.displayName?.trim() || m.userId.slice(0, 8)`, из-за
 * чего одинокий пользователь в workspace видел свой собственный UUID
 * («5d9e354f»). Теперь чип того же юзера показывает его email-префикс +
 * маленькую плашку «вы» — сразу понятно, кто это.
 */
function MemberPicker({
  members,
  value,
  onToggle,
  emptyLabel,
  memberLabel,
  isCurrentUser,
  youBadge,
}: {
  members: WorkspaceMemberPayload[];
  value: string[];
  onToggle: (uid: string) => void;
  emptyLabel: string;
  memberLabel: (m: WorkspaceMemberPayload) => string;
  isCurrentUser: (m: WorkspaceMemberPayload) => boolean;
  youBadge: string;
}) {
  if (members.length === 0) {
    return <p className="m-0 text-[11px] text-muted">{emptyLabel}</p>;
  }
  return (
    <div className="flex max-h-[160px] flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-(--border)/60 bg-(--surface) p-2">
      {members.map((m) => {
        const selected = value.includes(m.userId);
        const label = memberLabel(m);
        const me = isCurrentUser(m);
        return (
          <button
            key={m.userId}
            type="button"
            onClick={() => onToggle(m.userId)}
            aria-pressed={selected}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              selected
                ? "border-accent/40 bg-accent/15 text-accent"
                : "border-(--border) bg-(--surface-secondary)/40 text-(--foreground) hover:bg-(--surface-secondary)"
            }`}
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 text-[9px] font-bold uppercase text-accent"
              aria-hidden
            >
              {label[0]?.toUpperCase() ?? "?"}
            </span>
            <span className="truncate max-w-[140px]">{label}</span>
            {me && (
              <span
                className="rounded-full bg-accent/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-accent"
                aria-label={youBadge}
              >
                {youBadge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
