"use client";

/**
 * Julow Toast — кастомный stack-toaster в духе нашего design-system.
 *
 * # Что внутри
 *
 *  - **API**: `toast.success | error | warning | info | dismiss`
 *    (drop-in замена для `sonner.toast`, поддерживает `description`,
 *    `duration`, `action`, `onClick`, `id`).
 *  - **Store**: маленький singleton-публикатор поверх `useSyncExternalStore`.
 *  - **`<Toaster />`**: viewport в `document.body`, абсолютно
 *    позиционированный сверху-справа, стак из max N тостов.
 *  - **Стэкование**: коллапсированный стак (последние ~3 виднеются "из-под"
 *    переднего, чуть уменьшаются и смещаются вниз). При hover контейнер
 *    разворачивается в полную колонку с gap'ом — все тосты читаемы.
 *  - **Анимации**: `motion/react`. Spring-easing для вход/перестроение
 *    стэка, мягкий tween для exit. Уважает `prefers-reduced-motion`.
 *  - **Свайп вправо**: drag past threshold → dismiss.
 *  - **Auto-dismiss**: при hover паузим все таймеры, при leave —
 *    продолжаем с остатка (а не "сначала" — это раздражает).
 *  - **Тема**: фон/текст/тени реагируют на `[data-theme]` через
 *    tailwind dark-вариант + наши CSS-переменные.
 *  - **Адаптив**: ширина зажимается до `min(440px, 100vw - 32px)`.
 *
 * # Как пользоваться
 *
 * ```ts
 * import { toast } from "@/components/ui/toast";
 *
 * toast.success("Готово", { description: "Изменения сохранены" });
 * toast.error("Не удалось войти", {
 *   description: "Сервер недоступен",
 *   action: { label: "Повторить", onClick: () => retry() },
 * });
 * toast.info("Новое сообщение", {
 *   description: "Иван: «привет, как дела?»",
 *   onClick: () => router.push("/chats?chat=abc"),
 *   action: { label: "Открыть", onClick: () => router.push("/chats?chat=abc") },
 * });
 * ```
 *
 * А `<Toaster />` должен стоять один раз на всю апку (в `Providers`).
 */

import * as React from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { X } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────────────── */

export type ToastVariant =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "notification";

export interface ToastAction {
  /** Текст на правой кнопке (примерно как «Got It!» / «Fixing!» из примера). */
  label: string;
  /** Хэндлер клика. Тост закрывается автоматически ПОСЛЕ вызова. */
  onClick: () => void;
}

export interface ToastOptions {
  /** Второстепенная строка под заголовком. */
  description?: string;
  /**
   * Время жизни в миллисекундах. `0`, `Infinity` или отрицательное → тост
   * persistent (закроется только вручную / по action).
   */
  duration?: number;
  /** Кнопка-действие справа. */
  action?: ToastAction;
  /** Клик по корпусу тоста. После вызова тост закрывается. */
  onClick?: () => void;
  /**
   * Фиксированный `id` — если повторно вызвать `toast.*` с тем же `id`,
   * существующий тост обновится (а не создастся новый рядом).
   */
  id?: string;
}

interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  action?: ToastAction;
  onClick?: () => void;
  /** Эффективный duration в мс (после нормализации). */
  duration: number;
  /** Когда был добавлен/обновлён — для расчёта оставшегося времени после pause. */
  createdAt: number;
  /** Сколько мс осталось до auto-dismiss, если он сейчас на паузе. `null` пока не на паузе. */
  remainingOnPause: number | null;
}

/* ─────────────────────────────────────────────────────────────
 * Store — singleton, безопасный для SSR
 * ───────────────────────────────────────────────────────────── */

const DEFAULT_DURATION = 4500;
const MAX_ITEMS = 12; // защитная верхняя граница на размер очереди

const subscribers = new Set<() => void>();
let queue: ToastItem[] = [];
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(): void {
  subscribers.forEach((cb) => cb());
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function getSnapshot(): ToastItem[] {
  return queue;
}

/** Серверный снимок — пустой массив, иначе React ругается на hydration. */
function getServerSnapshot(): ToastItem[] {
  return EMPTY;
}
const EMPTY: ToastItem[] = [];

function genId(): string {
  // crypto.randomUUID есть в SSR (node 19+) и во всех современных браузерах,
  // но защитимся фолбэком.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clearTimer(id: string): void {
  const handle = timers.get(id);
  if (handle !== undefined) {
    clearTimeout(handle);
    timers.delete(id);
  }
}

function scheduleAutoDismiss(id: string, duration: number): void {
  if (!Number.isFinite(duration) || duration <= 0) return;
  clearTimer(id);
  const handle = setTimeout(() => {
    dismissInternal(id);
  }, duration);
  timers.set(id, handle);
}

function dismissInternal(id?: string): void {
  if (id === undefined) {
    queue.forEach((it) => clearTimer(it.id));
    queue = [];
  } else {
    clearTimer(id);
    queue = queue.filter((it) => it.id !== id);
  }
  emit();
}

function pushToast(
  variant: ToastVariant,
  title: string,
  opts?: ToastOptions,
): string {
  const id = opts?.id ?? genId();
  const durationRaw = opts?.duration ?? DEFAULT_DURATION;
  const duration =
    !Number.isFinite(durationRaw) || durationRaw <= 0 ? 0 : durationRaw;

  const item: ToastItem = {
    id,
    variant,
    title,
    description: opts?.description,
    action: opts?.action,
    onClick: opts?.onClick,
    duration,
    createdAt: Date.now(),
    remainingOnPause: null,
  };

  const existingIndex = queue.findIndex((it) => it.id === id);
  if (existingIndex >= 0) {
    // Обновление существующего тоста: подменяем без создания дубликата.
    queue = queue.map((it) => (it.id === id ? item : it));
  } else {
    // Новый тост — вставляем спереди (он будет верхним в стэке).
    queue = [item, ...queue].slice(0, MAX_ITEMS);
  }
  scheduleAutoDismiss(id, duration);
  emit();
  return id;
}

/**
 * Поставить все таймеры на паузу — вызывается при hover контейнера.
 * Сохраняет в `remainingOnPause` оставшееся время для каждого тоста,
 * чтобы `resumeAllTimers` не сбрасывало отсчёт.
 */
function pauseAllTimers(): void {
  const now = Date.now();
  let changed = false;
  queue.forEach((it) => {
    if (it.duration <= 0) return; // persistent — не трогаем
    if (it.remainingOnPause !== null) return; // уже на паузе
    const elapsed = now - it.createdAt;
    const remaining = Math.max(it.duration - elapsed, 800);
    it.remainingOnPause = remaining;
    clearTimer(it.id);
    changed = true;
  });
  if (changed) emit();
}

/** Снимаем паузу — каждый тост получает таймер на остаток своего времени. */
function resumeAllTimers(): void {
  let changed = false;
  queue.forEach((it) => {
    if (it.remainingOnPause === null) return;
    const remaining = it.remainingOnPause;
    it.remainingOnPause = null;
    it.createdAt = Date.now() - (it.duration - remaining);
    scheduleAutoDismiss(it.id, remaining);
    changed = true;
  });
  if (changed) emit();
}

/* ─────────────────────────────────────────────────────────────
 * Public API
 * ───────────────────────────────────────────────────────────── */

export const toast = {
  success: (title: string, opts?: ToastOptions) =>
    pushToast("success", title, opts),
  error: (title: string, opts?: ToastOptions) =>
    pushToast("error", title, opts),
  warning: (title: string, opts?: ToastOptions) =>
    pushToast("warning", title, opts),
  info: (title: string, opts?: ToastOptions) => pushToast("info", title, opts),
  /**
   * Push-уведомление с иконкой-колокольчиком слева и опциональной
   * кнопкой «Перейти» справа. Используется для real-time событий с
   * WS (`notification.created`, новые сообщения чата и т.п.). Цвета
   * нейтральные (accent — фиолет/бренд), а не «успех/ошибка», чтобы
   * пользователь сразу отличал информативный bell-toast от статусного.
   */
  notification: (title: string, opts?: ToastOptions) =>
    pushToast("notification", title, opts),
  /**
   * Закрыть конкретный тост. Без аргумента — закрыть все.
   */
  dismiss: (id?: string) => dismissInternal(id),
};

/* ─────────────────────────────────────────────────────────────
 * Иконки — inline SVG, чтобы 1-в-1 совпадало с дизайн-референсом
 * (заливка цвет + белая глифа сверху), без зависимости от того,
 * какие path'ы лежат в lucide-react в данной версии.
 * ───────────────────────────────────────────────────────────── */

const ICON_COLOR: Record<ToastVariant, string> = {
  success: "#22C55E", // emerald-500
  error: "#EF4444", // red-500
  warning: "#F59E0B", // amber-500
  info: "#3B82F6", // blue-500
  // notification — наш brand-accent (фиолет). На светлой теме —
  // насыщенный violet-500, на тёмной чуть светлее (violet-400) для
  // лучшей читаемости на графитовом фоне. Переключаем через CSS
  // current-color: см. ToastIcon ниже.
  notification: "#8B5CF6", // violet-500 (fallback, override via class)
};

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const fill = ICON_COLOR[variant];
  if (variant === "notification") {
    // Bell-бейдж: круглая «таблетка» с белым колокольчиком сверху.
    // Цвет фона — текущий currentColor спана, который мы переключаем
    // по теме (violet-500 light / violet-400 dark) — благодаря этому
    // и light, и dark выглядят гармонично, без жёстко зашитого hex.
    return (
      <span className="relative inline-grid h-7 w-7 shrink-0 place-items-center text-[#8B5CF6] dark:text-[#A78BFA]">
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="absolute inset-0 h-full w-full"
          fill="currentColor"
        >
          <circle cx="12" cy="12" r="11" />
        </svg>
        {/*
          Колокольчик: купол, язычок и «качающаяся» точка снизу. Stroke
          3.0, linejoin/linecap round — те же пропорции жирности, что и
          в success/info/error глифах, чтобы стэк выглядел согласованно.
          Глиф «крупнее центра» (h-4 w-4 в 28-пиксельном бейдже) — иначе
          колокольчик читался бы как «точка».
        */}
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="relative h-4 w-4"
          fill="none"
          stroke="white"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6.5 16.5h11l-1.3-1.6a3 3 0 0 1-.7-1.9V10.5a4.5 4.5 0 1 0-9 0v2.5a3 3 0 0 1-.7 1.9z" />
          <path d="M10.5 19a1.5 1.5 0 0 0 3 0" />
        </svg>
      </span>
    );
  }
  if (variant === "success") {
    // Зубчатая «печать» (verified-badge) с белой галкой.
    return (
      <span className="relative inline-grid h-7 w-7 shrink-0 place-items-center">
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="absolute inset-0 h-full w-full"
          fill={fill}
        >
          <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
        </svg>
        {/*
          Глифчик: чуть больше (16px вместо 14) и заметно жирнее (stroke 3.6).
          Path удлинён — `m6 12.5 3.8 3.8 7.5-7.5` рисует крупную галку,
          уезжающую почти в полные углы внутреннего viewBox'а 24×24.
          `linejoin=round` + `linecap=round` дают мягкий «детский» силуэт,
          как в нативных iOS/macOS success-стилях.
        */}
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="relative h-4 w-4"
          fill="none"
          stroke="white"
          strokeWidth={3.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 12.5 3.8 3.8 7.5-7.5" />
        </svg>
      </span>
    );
  }
  if (variant === "info") {
    return (
      <span className="relative inline-grid h-7 w-7 shrink-0 place-items-center">
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="absolute inset-0 h-full w-full"
          fill={fill}
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
        {/*
          Буква «i»: точка крупнее (r=1.7 вместо 1.4), стебелёк шире и выше
          (3.4×8 вместо 2.4×7) — чтобы при 28-пиксельном бейдже глиф читался
          как полноценная типографическая «i», а не как точка-палочка.
        */}
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="relative h-4 w-4"
          fill="white"
        >
          <circle cx="12" cy="7.4" r="1.7" />
          <rect x="10.3" y="10.4" width="3.4" height="8" rx="1.7" />
        </svg>
      </span>
    );
  }
  // error / warning — закруглённый треугольник с восклицательным
  return (
    <span className="relative inline-grid h-7 w-7 shrink-0 place-items-center">
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="absolute inset-0 h-full w-full"
        fill={fill}
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
      {/*
        Восклицательный: стебель 3.4×8 (был 2.2×6.5), точка r=1.7 (была 1.15) —
        тот же расчёт, что и для «i», только инвертированно по вертикали.
      */}
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="relative h-4 w-4"
        fill="white"
      >
        <rect x="10.3" y="7.4" width="3.4" height="8" rx="1.7" />
        <circle cx="12" cy="18.4" r="1.7" />
      </svg>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * ToastCard — один тост в стэке
 * ───────────────────────────────────────────────────────────── */

/** Геометрия стэка. */
const STACK_PEEK = 14; // насколько каждый следующий тост торчит из-под переднего
const STACK_GAP = 12; // gap между тостами в развёрнутом виде
const STACK_HEIGHT = 76; // ожидаемая высота тоста (px) — для расчёта y в expanded
const VISIBLE_BEHIND_FRONT = 2; // сколько за передним показывать «горкой» из-под низа

/**
 * Сколько мс ждём после `mouseleave`/`focusout` прежде чем свернуть стэк.
 * Это анти-«дёрганость»: если пользователь случайно увёл курсор за край
 * (или вернётся за action-кнопкой / следующим тостом) — стэк не схлопнется
 * мгновенно. Возврат курсора в течение этого окна отменяет свёртку.
 *
 * Auto-dismiss таймеры всё это время остаются на паузе — поэтому грейс-
 * период не «обкрадывает» пользователя по времени чтения.
 */
const COLLAPSE_DELAY_MS = 2000;

type ActionVariant = "subtle" | "primary";

/**
 * Какой стиль action-кнопки использовать для каждого типа тоста.
 *
 * success/info — «нейтральный» приглушённый pill (как «Got It!» в примере);
 * error/warning — высококонтрастный «primary» pill (как «Fixing!» в примере).
 */
const ACTION_STYLE: Record<ToastVariant, ActionVariant> = {
  success: "subtle",
  error: "primary",
  warning: "primary",
  info: "subtle",
  // notification — нейтральный «Перейти», как «Got It!» в референсе;
  // primary бы перекрикивал колокольчик и заголовок.
  notification: "subtle",
};

function ToastCard({
  item,
  index,
  expanded,
  total,
}: {
  item: ToastItem;
  index: number;
  expanded: boolean;
  total: number;
}) {
  const prefersReduced = useReducedMotion();

  const transition: Transition = prefersReduced
    ? { duration: 0.01 }
    : {
        type: "spring",
        stiffness: 380,
        damping: 32,
        mass: 0.75,
      };

  /**
   * Флажок «только что был drag».
   *
   * Сценарий бага без него: пользователь тянет тост вправо, чтобы
   * закрыть. Motion срабатывает drag, но БРАУЗЕР после `pointerup`
   * всё равно синтезирует `click` на корпусе. Этот click шёл в
   * `handleBodyClick`, который выполнял `item.onClick` → открывался
   * Sheet/чат/задача, хотя пользователь хотел только закрыть.
   *
   * Решение: пишем `true` в `onDragStart` и сбрасываем `false` на
   * следующий tick после `onDragEnd`. `handleBodyClick` сначала
   * читает ref и, если был drag, молча выходит — `dismissInternal`
   * уже выполняется внутри `onDragEnd` по threshold'у, отдельный
   * close не нужен.
   *
   * Motion переходит в drag только после ~3px движения (внутренний
   * threshold), поэтому короткий тап остаётся именно тапом — флажок
   * не зажигается, и `item.onClick` отрабатывает как и раньше.
   */
  const draggedRef = useRef(false);

  // ── Геометрия в стэке ─────────────────────────────────────
  // collapsed:
  //   index 0   → y=0,   scale=1.00, opacity=1
  //   index 1   → y=14,  scale=0.96, opacity=0.92
  //   index 2   → y=28,  scale=0.92, opacity=0.78
  //   index ≥3  → fade-out (но всё ещё в DOM, чтобы при удалении переднего
  //               следующий красиво всплыл)
  // expanded:
  //   index N   → y = N * (STACK_HEIGHT + STACK_GAP), scale=1, opacity=1
  const y = expanded
    ? index * (STACK_HEIGHT + STACK_GAP)
    : Math.min(index, VISIBLE_BEHIND_FRONT + 1) * STACK_PEEK;
  const scale = expanded
    ? 1
    : Math.max(1 - index * 0.04, 0.88);
  const opacity = expanded
    ? 1
    : index <= VISIBLE_BEHIND_FRONT
      ? 1 - index * 0.08
      : 0;

  const actionStyle = ACTION_STYLE[item.variant];

  /**
   * Хэндлер клика по корпусу тоста.
   * Не вмешивается, если клик произошёл на action-кнопке (нативная
   * пропогация — `stopPropagation` в action-кнопке).
   */
  const handleBodyClick = useCallback(() => {
    // Если только что произошёл drag (свайп, пусть даже без
    // достижения dismiss-threshold) — браузер всё равно файрит
    // `click` после `pointerup`. Проводим его мимо item.onClick,
    // иначе попытка свайпом закрыть тост откроет sheet/чат/задачу.
    // dismissInternal внутри `onDragEnd` уже сработал (если прошёл
    // threshold) — здесь доп. закрывания не требуется.
    if (draggedRef.current) return;
    if (item.onClick) {
      try {
        item.onClick();
      } catch {
        /* не падаем из-за пользовательской ошибки */
      }
    }
    dismissInternal(item.id);
  }, [item.onClick, item.id]);

  const handleActionClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        item.action?.onClick();
      } catch {
        /* see above */
      }
      dismissInternal(item.id);
    },
    [item.action, item.id],
  );

  /**
   * Клик по крестику. В отличие от `handleBodyClick` — НЕ вызывает
   * `item.onClick`: это явный отказ от взаимодействия, а не «принять
   * и закрыть». Иначе пользователь, нажимая ✕, случайно бы переходил
   * к чату/задаче/прочему deep-link'у.
   */
  const handleCloseClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dismissInternal(item.id);
    },
    [item.id],
  );

  return (
    <motion.li
      layout
      initial={{ x: 480, opacity: 0, scale: 0.9 }}
      animate={{ x: 0, y, opacity, scale }}
      exit={{
        x: 480,
        opacity: 0,
        scale: 0.92,
        transition: prefersReduced
          ? { duration: 0.01 }
          : { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
      }}
      transition={transition}
      drag={prefersReduced ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.55 }}
      dragMomentum={false}
      /*
       * Motion вызывает `onDragStart` после своего внутреннего drag-
       * threshold (~3px), поэтому короткий тап сюда НЕ попадает
       * — `draggedRef` остаётся false, и `handleBodyClick` выполнит
       * item.onClick как обычный клик.
       */
      onDragStart={() => {
        draggedRef.current = true;
      }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110 || info.velocity.x > 600) {
          dismissInternal(item.id);
        }
        // Сбрасываем на следующем macrotask, чтобы синхронный
        // `click`-event после pointerup увидел ref всё ещё = true
        // и корректно проигнорировал синтетический вызов.
        setTimeout(() => {
          draggedRef.current = false;
        }, 0);
      }}
      style={{
        // z-index по «обратному» индексу — передний тост должен быть выше
        zIndex: total - index,
        transformOrigin: "100% 0%",
      }}
      className="pointer-events-auto absolute top-0 right-0 w-full select-none"
      role="status"
      aria-live={item.variant === "error" ? "assertive" : "polite"}
    >
      {/*
        Внешний контейнер — обычный `<div>`, не `<button>`. Это важно:
        внутри лежит реальная action-`<button>`, а nested interactive
        content в HTML невалиден. Семантика «уведомление» задаётся через
        `role="status"` / `aria-live` на родительском `<motion.li>` выше —
        screen reader всё корректно озвучит. Клик по корпусу — просто
        удобный mouse-shortcut закрыть тост.

        `group/card` — именованная tailwind-группа, чтобы кнопка-крестик
        ниже могла слушать hover ИМЕННО этой карточки, а не любого
        родительского group-а (стэка / оборачивающего li).
      */}
      <div
        onClick={handleBodyClick}
        className={[
          "group/card relative",
          // База: layout + типографика контейнера
          "flex w-full cursor-pointer items-center gap-3 rounded-2xl",
          "px-4 py-3 sm:gap-3.5 sm:py-3.5",
          "text-left transition-[box-shadow,background] duration-200",
          // Light-тема (по умолчанию): светлая поверхность, тёмный текст,
          // мягкая нейтральная тень — приятно ложится на любую страницу.
          "bg-white text-zinc-900 ring-1 ring-zinc-900/6",
          "shadow-[0_18px_38px_-14px_rgba(15,15,20,0.18),0_6px_14px_-6px_rgba(15,15,20,0.12)]",
          "hover:shadow-[0_22px_44px_-12px_rgba(15,15,20,0.22),0_8px_18px_-6px_rgba(15,15,20,0.16)]",
          // Dark-тема: глубокая графитовая поверхность 1-в-1 как в макете,
          // тонкий inner-highlight через ring + сильная глубинная тень.
          "dark:bg-[#1B1C20] dark:text-zinc-100 dark:ring-white/6",
          "dark:shadow-[0_18px_38px_-14px_rgba(0,0,0,0.55),0_6px_14px_-6px_rgba(0,0,0,0.4)]",
          "dark:hover:shadow-[0_22px_44px_-12px_rgba(0,0,0,0.6),0_8px_18px_-6px_rgba(0,0,0,0.45)]",
        ].join(" ")}
      >
        <ToastIcon variant={item.variant} />

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={[
              "truncate text-[15px] font-semibold tracking-[-0.005em]",
              "leading-tight text-zinc-900 dark:text-white",
            ].join(" ")}
          >
            {item.title}
          </span>
          {item.description ? (
            <span
              className={[
                "truncate text-[13px] font-normal leading-[1.35]",
                "text-zinc-500 dark:text-zinc-400",
              ].join(" ")}
            >
              {item.description}
            </span>
          ) : null}
        </span>

        {item.action ? (
          <button
            type="button"
            onClick={handleActionClick}
            // `pointerdown` блокируем, чтобы motion-drag не «перехватил»
            // нажатие на кнопке — иначе тост может уехать в swipe-out
            // одновременно с кликом action.
            onPointerDown={(e) => e.stopPropagation()}
            className={[
              "ml-1 inline-flex shrink-0 items-center justify-center",
              "h-9 rounded-xl px-3.5 text-[13.5px] font-semibold",
              "transition-[background,transform] duration-150",
              "outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/40 dark:focus-visible:ring-white/50",
              "active:scale-[0.97]",
              actionStyle === "primary"
                ? // primary — высококонтрастный pill для error/warning.
                  // В light: тёмный pill на светлом тосте.
                  // В dark:  белый pill на тёмном тосте (как «Fixing!»).
                  "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                : // subtle — приглушённый pill для success/info.
                  // В light: лёгкая зинковая заливка на белом.
                  // В dark:  белая «дымка» на тёмном (как «Got It!»).
                  "bg-zinc-900/6 text-zinc-900 hover:bg-zinc-900/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
            ].join(" ")}
          >
            {item.action.label}
          </button>
        ) : null}

        {/*
          Крестик-закрытие. Появляется только при hover ИМЕННО этой
          карточки (а не задних в стэке) — `group-hover/card`. Лежит
          абсолютно поверх правого верхнего угла; визуально чуть-чуть
          захватывает action-кнопку, но `z-10` + `pointer-events-auto`
          делают его hit-area предсказуемой.

          Цвет — приглушённый «по умолчанию», подчёркнутый на hover.
          Контраст переключается по теме: серая иконка на светлой
          плашке, белёсая на тёмной — чтобы крестик было видно, но
          он не воровал визуальный приоритет у заголовка / action'а.
        */}
        <button
          type="button"
          aria-label="Закрыть уведомление"
          onClick={handleCloseClick}
          onPointerDown={(e) => e.stopPropagation()}
          className={[
            "absolute top-1.5 right-1.5 z-10",
            "inline-grid h-6 w-6 place-items-center rounded-full",
            "text-zinc-500 hover:bg-zinc-900/8 hover:text-zinc-900",
            "dark:text-zinc-400 dark:hover:bg-white/12 dark:hover:text-white",
            // Десктоп: fade-in только при hover/focus карточки.
            // Тач-устройства всё равно увидят крестик после первого тапа
            // (синтезированный hover) либо могут смахнуть тост вправо
            // — drag-to-dismiss включён.
            "opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100",
            "transition-[opacity,background,color] duration-150",
            "outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 dark:focus-visible:ring-white/40",
          ].join(" ")}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      </div>
    </motion.li>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Toaster — viewport, рендерится в document.body через portal
 * ───────────────────────────────────────────────────────────── */

/**
 * Глобальный viewport для тостов. Должен быть смонтирован один раз
 * на всю апку (мы вешаем его в `Providers`).
 *
 * Стэк скукоженный по умолчанию: видно ~3 верхних слоя «друг из-под друга».
 * На hover контейнера тосты раздвигаются в полноценную колонку с gap'ом
 * и таймеры auto-dismiss приостанавливаются — пользователь успевает
 * прочитать и при желании кликнуть action.
 */
export function Toaster() {
  const list = useSyncExternalStore<ToastItem[]>(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  /**
   * Таймер отложенной свёртки. Создаётся на `mouseleave`/`focusout`,
   * сбрасывается на `mouseenter`/`focus` если пользователь вернулся
   * в стэк до истечения `COLLAPSE_DELAY_MS`. Также чистится на
   * unmount, чтобы не привести stale-таймер к `setState` после
   * размонтирования.
   */
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Стандартная анти-SSR-флэш техника: рендерим тосты только после
    // первого клиент-эффекта, чтобы не было mismatch'а с SSR-разметкой
    // (на сервере очередь всегда пустая через `getServerSnapshot`).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  /** Снять отложенную свёртку, если она запланирована. */
  const cancelDeferredCollapse = useCallback(() => {
    if (collapseTimerRef.current !== null) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }, []);

  /** Запустить таймер свёртки. Если таймер уже идёт — перезапускаем. */
  const scheduleCollapse = useCallback(() => {
    cancelDeferredCollapse();
    collapseTimerRef.current = setTimeout(() => {
      collapseTimerRef.current = null;
      setExpanded(false);
      resumeAllTimers();
    }, COLLAPSE_DELAY_MS);
  }, [cancelDeferredCollapse]);

  // Чистим pending-таймер на unmount (logout, route change и т.п.).
  useEffect(() => cancelDeferredCollapse, [cancelDeferredCollapse]);

  const handleMouseEnter = useCallback(() => {
    cancelDeferredCollapse();
    setExpanded(true);
    pauseAllTimers();
  }, [cancelDeferredCollapse]);

  const handleMouseLeave = useCallback(() => {
    // НЕ свёртываем сразу — даём пользователю ~2с грейс-окно. Если он
    // вернётся за action-кнопкой / следующим тостом — `handleMouseEnter`
    // отменит таймер и стэк останется развёрнутым.
    scheduleCollapse();
  }, [scheduleCollapse]);

  // На клавиатурном фокусе ВНУТРИ стэка тоже считаем его «активным»:
  // юзер с клавиатуры должен иметь возможность прочитать без давления
  // таймера.
  const handleFocus = useCallback(() => {
    cancelDeferredCollapse();
    setExpanded(true);
    pauseAllTimers();
  }, [cancelDeferredCollapse]);
  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Фокус ушёл внутри того же стэка — не реагируем.
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      // Тот же грейс-период, что и для мыши — единый UX.
      scheduleCollapse();
    },
    [scheduleCollapse],
  );

  // Высота контейнера для корректной hit-area: иначе при collapsed
  // нижние absolute-тосты не получают hover (parent <ol> схлопывается
  // до высоты переднего).
  const containerHeight = useMemo(() => {
    if (list.length === 0) return 0;
    if (expanded) {
      return list.length * STACK_HEIGHT + (list.length - 1) * STACK_GAP;
    }
    // collapsed: высота переднего + peek-ы.
    return STACK_HEIGHT + Math.min(list.length - 1, VISIBLE_BEHIND_FRONT + 1) *
      STACK_PEEK;
  }, [list.length, expanded]);

  if (!mounted) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <ol
      aria-label="Уведомления"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
      // Сдвигаем стэк вниз на высоту хедера app-группы. Значение
      // `--toast-top-offset` выставляет `AppShell` (через ResizeObserver
      // на <header>). Если переменная не определена (landing, auth,
      // legal) — fallback 0px, тосты прижаты к верху как раньше.
      style={{ top: "var(--toast-top-offset, 0px)" }}
      className={[
        "pointer-events-none fixed right-0 z-200",
        // Адаптивная ширина и отступ от края: на мобильном тост занимает
        // почти всю ширину (минус 32px), на десктопе зажимается до 440px.
        "w-[min(440px,calc(100vw-32px))] p-4 sm:p-6",
        // Внутри — relative-контейнер вычисленной высоты, чтобы
        // absolute-позиционированные тосты получили предсказуемую hit-area.
      ].join(" ")}
    >
      <motion.div
        layout
        animate={{ height: containerHeight }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        className="pointer-events-none relative"
      >
        <AnimatePresence initial={false}>
          {list.map((item, index) => (
            <ToastCard
              key={item.id}
              item={item}
              index={index}
              total={list.length}
              expanded={expanded}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </ol>,
    document.body,
  );
}
