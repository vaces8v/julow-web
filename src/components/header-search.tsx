/**
 * HeaderSearch — поиск по задачам и проектам прямо из топ-хедера app-shell.
 *
 * Поведение:
 *   - debounced (250ms) query (`useState` + `useEffect` cleanup), чтобы не
 *     дёргать `/tasks/mine` на каждый keystroke;
 *   - параллельно: `api.getTasks({search})` (бэкенд-search) + локальный
 *     filter уже-загруженных `allProjects` по `name`;
 *   - dropdown через `createPortal` (потому что header'у `overflow:hidden`
 *     и `z-20` ему мало; portal в body даёт честный `position:fixed`
 *     и z-индекс выше остальных элементов);
 *   - Esc/click-outside закрывает dropdown, ⌘F / Ctrl+F фокусит input;
 *   - клик по проекту → `/projects/[id]`, по задаче → `/projects/[projectId]?task=[taskId]`;
 *   - keyboard nav (↑/↓/Enter) — по плоскому списку (projects → tasks).
 *
 * Дизайн: matches the existing app-shell aesthetics (subtle border,
 * rounded-xl, transition expand-on-focus). Темно-/светло-тема через
 * `isDark`-prop, потому что app-shell сам управляет темой и нам её
 * проще передать, чем читать из контекста.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search01Icon } from "hugeicons-react";
import { api, type ProjectPayload, type TaskPayload } from "@/lib/api";
import { useI18n } from "@/i18n/context";

type Props = {
  /** Текущая тема — управляется app-shell, нужна для бордеров/плейсхолдера. */
  isDark: boolean;
  /** Скрывает шорткат-чип `⌘F` когда хедер сжат при scroll. */
  scrolled: boolean;
  /** Все проекты юзера во всех workspace'ах — приходят из `useWorkspaceShell`. */
  projects: ProjectPayload[];
};

/** Сколько элементов max в каждой секции dropdown'а. */
const PROJECTS_LIMIT = 5;
const TASKS_LIMIT = 8;
/** Debounce для query — баланс между отзывчивостью и нагрузкой на бэк. */
const DEBOUNCE_MS = 250;

type SearchHit =
  | { kind: "project"; project: ProjectPayload }
  | { kind: "task"; task: TaskPayload };

export function HeaderSearch({ isDark, scrolled, projects }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskPayload[]>([]);
  const [loading, setLoading] = useState(false);
  /** Активный индекс для keyboard-nav. -1 = ничего не выделено. */
  const [activeIdx, setActiveIdx] = useState(-1);
  /** Координаты для портала dropdown'а — пересчитываются при resize/scroll.
   *  Привязываем к ПРАВОМУ краю input'а (right = viewport.width - input.right),
   *  чтобы дропдаун рос влево, а не торчал вправо за пределы input'а при
   *  активном min-width. Иначе при узком input'е (например 200px) и
   *  min-width 320 dropdown визуально «съезжал» вправо. */
  const [menuPos, setMenuPos] = useState<{ top: number; right: number; width: number } | null>(
    null,
  );

  /* ── Debounce ─────────────────────────────────────────────────── */
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setDebouncedQuery("");
      return;
    }
    const id = setTimeout(() => setDebouncedQuery(q), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  /* ── Fetch tasks ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!debouncedQuery) {
      setTasks([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      // Берём с запасом (×2) — бэк иногда отдаёт шум (см. ниже sanity-filter),
      // и после клиентского отсева нам нужен запас, чтобы дропдаун не пустел.
      .getTasks(undefined, { search: debouncedQuery, limit: TASKS_LIMIT * 2 })
      .then((res) => {
        if (cancelled) return;
        /**
         * Sanity-filter: бэкенд `/tasks/mine?search=` на практике возвращает
         * задачи без совпадения с query (см. репорт со скриншотом — запрос
         * «фывфы» дал результаты «asdasd / выфаы / sadasd», в которых
         * этой подстроки нет). Чтобы suggestion-list был честным,
         * отсеиваем результаты, где query не встречается ни в title,
         * ни в labels. Если бэк работает корректно — filter ничего
         * не выбросит.
         */
        const q = debouncedQuery.toLowerCase();
        const matched = res
          .filter((t) => {
            const inTitle = t.title.toLowerCase().includes(q);
            const inLabels = t.labels?.some((l) => l.toLowerCase().includes(q));
            return inTitle || inLabels;
          })
          .slice(0, TASKS_LIMIT);
        setTasks(matched);
      })
      .catch(() => {
        if (cancelled) return;
        setTasks([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  /* ── Локальный filter проектов по имени ───────────────────────── */
  const filteredProjects = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    if (!q) return [] as ProjectPayload[];
    return projects
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, PROJECTS_LIMIT);
  }, [projects, debouncedQuery]);

  /** Плоский упорядоченный список для keyboard-nav. */
  const flatHits = useMemo<SearchHit[]>(() => {
    return [
      ...filteredProjects.map((p) => ({ kind: "project" as const, project: p })),
      ...tasks.map((task) => ({ kind: "task" as const, task })),
    ];
  }, [filteredProjects, tasks]);

  /** Project-id → project (нужен чтобы для каждой задачи показывать её проект). */
  const projectById = useMemo(() => {
    const m = new Map<string, ProjectPayload>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  /* ── Position portal dropdown ─────────────────────────────────── */
  const updatePosition = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({
      top: r.bottom + 6,
      right: window.innerWidth - r.right,
      width: Math.max(r.width, 320),
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  /* ── Click outside / Esc to close ─────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* ── ⌘F / Ctrl+F глобальный шорткат фокуса ──────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const cmdF = isMac ? e.metaKey && e.key.toLowerCase() === "f" : e.ctrlKey && e.key.toLowerCase() === "f";
      if (cmdF) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── Reset active idx когда меняются hits ─────────────────────── */
  useEffect(() => {
    setActiveIdx(-1);
  }, [flatHits.length]);

  /* ── Navigation ───────────────────────────────────────────────── */
  const goToHit = useCallback(
    (hit: SearchHit) => {
      if (hit.kind === "project") {
        router.push(`/projects/${hit.project.id}`);
      } else {
        router.push(`/projects/${hit.task.projectId}?task=${hit.task.id}`);
      }
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    },
    [router],
  );

  /* ── Input keydown: arrows / Enter ────────────────────────────── */
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (flatHits.length === 0 ? -1 : (i + 1) % flatHits.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (flatHits.length === 0 ? -1 : (i - 1 + flatHits.length) % flatHits.length));
      return;
    }
    if (e.key === "Enter") {
      if (activeIdx >= 0 && activeIdx < flatHits.length) {
        e.preventDefault();
        goToHit(flatHits[activeIdx]);
      } else if (flatHits.length > 0) {
        // Enter без выбора стрелками — открываем первый результат.
        e.preventDefault();
        goToHit(flatHits[0]);
      }
    }
  };

  /* ── Стилевые helper'ы ────────────────────────────────────────── */
  const inputCls = `w-56 lg:w-64 focus:w-72 lg:focus:w-80 rounded-xl border text-xs transition-all duration-300 ease-out focus:outline-none ${
    scrolled ? "py-1.5 pl-8 pr-10" : "py-2 pl-9 pr-10"
  } ${
    isDark
      ? "border-white/8 bg-transparent text-white placeholder:text-white/25 focus:border-accent/40 focus:bg-white/6"
      : "border-black/6 bg-transparent text-foreground placeholder:text-muted/40 focus:border-accent/40 focus:bg-black/3"
  }`;

  const kbdCls = `absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border px-1.5 py-0.5 text-[9px] font-medium transition-opacity duration-200 group-focus-within/search:opacity-0 ${
    isDark
      ? "border-white/8 bg-white/4 text-white/30"
      : "border-black/[0.06] bg-black/[0.02] text-muted/50"
  }`;

  /* ── Подсчёты для empty/hint state ────────────────────────────── */
  const hasResults = flatHits.length > 0;
  const showHint = !debouncedQuery; // input ещё пустой
  const showEmpty = !!debouncedQuery && !loading && !hasResults;

  return (
    <>
      <div ref={wrapperRef} className="group/search relative hidden sm:block">
        <Search01Icon
          size={scrolled ? 14 : 15}
          strokeWidth={2}
          className={`absolute left-3 top-1/2 -translate-y-1/2 transition-all duration-300 ease-out ${
            isDark ? "text-white/25 group-focus-within/search:text-accent" : "text-muted/40 group-focus-within/search:text-accent"
          }`}
        />
        <input
          ref={inputRef}
          /*
           * Жёстко выключаем все механизмы автозаполнения. Браузеры
           * (Chrome/Edge) часто игнорируют простой autoComplete="off",
           * если форма выглядит "похожей на login". Поэтому накладываем
           * несколько защит:
           *  - type="search" — семантически правильный, говорит браузеру
           *    что это поисковый input;
           *  - name="julow-search-q" — уникальный префикс, не "email"
           *    и не "username", чтобы AutoFill не подставлял почту;
           *  - autoComplete="off" + role="combobox" / aria-autocomplete="list"
           *    говорят браузеру, что у нас собственное autocomplete-меню
           *    (открытое dropdown'ом), и его системные предложения не нужны;
           *  - data-lpignore / data-1p-ignore / data-form-type="other" —
           *    отключают LastPass, 1Password и Dashlane соответственно.
           */
          type="search"
          name="julow-search-q"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder={t.shell.searchPlaceholder}
          aria-label={t.shell.searchPlaceholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          className={inputCls}
        />
        <kbd className={kbdCls}>⌘F</kbd>
      </div>

      {open && menuPos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            className={`fixed z-[9999] overflow-hidden rounded-xl border shadow-[0_20px_60px_-10px_oklch(0%_0_0_/0.25)] backdrop-blur-2xl backdrop-saturate-150 ${
              isDark
                ? "border-border bg-surface/92 dark:shadow-[0_20px_60px_-10px_oklch(0%_0_0_/0.55)]"
                : "border-border/60 bg-white/96"
            }`}
            style={{
              top: menuPos.top,
              right: menuPos.right,
              width: menuPos.width,
              maxHeight: "min(60vh, 520px)",
              overflowY: "auto",
            }}
          >
            {/* hint state — query пустой */}
            {showHint && (
              <div className="px-4 py-5 text-xs text-muted">
                {t.shell.searchHint}
              </div>
            )}

            {/* loading state — query непустой, но fetch в полёте */}
            {!showHint && loading && (
              <div className="px-4 py-5 text-xs text-muted">
                {t.shell.searchLoading}
              </div>
            )}

            {/* empty state — query непустой, fetch завершён, ничего нет */}
            {showEmpty && (
              <div className="px-4 py-5 text-xs text-muted">{t.shell.searchEmpty}</div>
            )}

            {/* Projects section */}
            {!showHint && filteredProjects.length > 0 && (
              <div className="py-1.5">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
                  {t.shell.searchProjectsLabel}
                </div>
                {filteredProjects.map((p, i) => {
                  const idx = i;
                  const isActive = activeIdx === idx;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => goToHit({ kind: "project", project: p })}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                        isActive
                          ? isDark
                            ? "bg-white/8"
                            : "bg-black/4"
                          : "hover:bg-black/3 dark:hover:bg-white/5"
                      }`}
                    >
                      {/* Project color/avatar dot */}
                      <span
                        className="grid size-7 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white"
                        style={{ background: p.color ?? "#64748b" }}
                      >
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-foreground">
                          {p.name}
                        </div>
                        {p.description && (
                          <div className="truncate text-[10px] text-muted">
                            {p.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tasks section */}
            {!showHint && tasks.length > 0 && (
              <div className="py-1.5 border-t border-border/40">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
                  {t.shell.searchTasksLabel}
                </div>
                {tasks.map((task, i) => {
                  const idx = filteredProjects.length + i;
                  const isActive = activeIdx === idx;
                  const proj = projectById.get(task.projectId);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => goToHit({ kind: "task", task })}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                        isActive
                          ? isDark
                            ? "bg-white/8"
                            : "bg-black/4"
                          : "hover:bg-black/3 dark:hover:bg-white/5"
                      }`}
                    >
                      {/* Status dot */}
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: statusColor(task.status) }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-foreground">
                          {task.title}
                        </div>
                        <div className="flex items-center gap-1.5 truncate text-[10px] text-muted">
                          {proj && (
                            <span className="truncate">{proj.name}</span>
                          )}
                          {proj && <span className="opacity-50">·</span>}
                          <span className="uppercase tracking-wide">
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Цвет точки-индикатора статуса. Соответствует категории workflow:
 * todo / in_progress / review / done / blocked. Для незнакомых статусов —
 * нейтральный серый.
 */
function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("done") || s.includes("complete") || s.includes("closed")) return "#22c55e";
  if (s.includes("review")) return "#f97316";
  if (s.includes("progress") || s.includes("doing")) return "#3b82f6";
  if (s.includes("block")) return "#ef4444";
  if (s.includes("cancel")) return "#a1a1aa";
  return "#94a3b8";
}
