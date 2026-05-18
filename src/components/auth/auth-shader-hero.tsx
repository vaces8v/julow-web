"use client";

/**
 * AuthShaderHero — декоративная правая колонка экрана авторизации.
 *
 * Реализация — чистый CSS + `motion/react` (никаких WebGL, никаких
 * watermark, никаких внешних пакетов кроме уже используемого motion).
 * Визуально вдохновлено пресетом «Sunlight Bars» с shaders.com.
 *
 * Слои (от низа к верху):
 *   1. Базовый сине-фиолетовый linear-gradient.
 *   2. Диагональные «лучи» — repeating-linear-gradient под углом 115°,
 *      РАЗМЫТЫЕ через CSS `filter: blur(...)`, чтобы убрать резкие
 *      кромки (жалоба прошлой итерации). Один слой бэйз-лучей и один
 *      контр-слой с противоположным направлением для глубины.
 *   3. Тёплый солнечный блик в правом-верхнем углу + дополнительный
 *      холодный блик слева-снизу для баланса.
 *   4. Зернистая SVG-noise плёнка через mix-blend-mode soft-light.
 *   5. Левая маска под фон формы (`var(--background)`).
 *   6. ЦЕНТРАЛЬНАЯ морфинг-надпись (`MorphingWord`) — последовательно
 *      сменяет слова бренда/тематические термины с blur-fade-scale
 *      переходом.
 *   7. Tagline + subline в нижнем-левом углу.
 *
 * Анимации — медленные (90s / 14s основные циклы) и motion-safe.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/context";
import { JulowShader } from "@/components/ui/julow-shader";

/**
 * Слова для морфинга в центре hero-блока идут из i18n-словаря
 * (`auth.heroWords`) — одна строка через запятую, первое — бренд («Julow»),
 * дальше продуктовые понятия, перекликающиеся с tagline/subline.
 * (Строка + split, а не массив в i18n из-за `StringTree<T>` — type
 * для переводов разрешает только строковые leaves.)
 */
const FALLBACK_WORDS = ["Julow"] as const;

/**
 * Интервал смены слова. Мы ужали предыдущие 4200мс на ~250мс,
 * чтобы ритм был чуть живее, но при этом не воспринимался как
 * «мигалка». 3950мс — свит spot между «успел прочитать» и «живое
 * дыхание бренда».
 */
const MORPH_INTERVAL_MS = 3950;

/**
 * Морфинг-надпись. Использует motion/react AnimatePresence для cross-fade
 * со сглаживанием blur'ом и микро-scale'ом — выглядит как настоящий
 * letter-morph (без библиотеки flubber/SVG).
 *
 * Reduced-motion: рендерим статично слово #0 без переключений вообще —
 * это и доступнее, и дешевле по rAF.
 */
function MorphingWord() {
  const reduced = useReducedMotion();
  const { t } = useI18n();
  const [index, setIndex] = useState(0);

  // Разбиваем i18n-строку в массив. Допускаем
  // «word ,  word» и «word,word» — обрезаем пробелы, отфильтровываем
  // пустые сегменты. Если каким-то чудом список пуст — фолбек на
  // «Julow», чтобы hero не «мигнул» пустотой.
  const words = useMemo(() => {
    const raw = (t.auth as { heroWords?: string }).heroWords ?? "";
    const parsed = raw
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);
    return parsed.length > 0 ? parsed : (FALLBACK_WORDS as readonly string[]);
  }, [t.auth]);

  // Смена локали не должна выводить index за границы нового
  // массива. На всякий случай «прижимаем» его по modulo при выборе слова.
  const word = words[index % words.length];

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIndex((i) => (i + 1) % words.length);
    }, MORPH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reduced, words.length]);

  /**
   * Группируем фразу по словам (и пробелам как отдельным «слотам»),
   * чтобы линия переноса могла проходить ТОЛЬКО между словами, а не
   * между отдельными буквами. Внешний контейнер видит каждый word-span
   * как inline-block-«атом» — браузер либо ставит его на текущую строку
   * целиком, либо переносит ВСЁ слово на следующую. У word-span'а внутри
   * `whitespace-nowrap`, что окончательно блокирует разрыв внутри.
   *
   * Дополнительно посчитаем `total` — общее число анимируемых букв
   * (без пробелов) — он нужен, чтобы (а) дать каждой букве её
   * глобальный индекс для расчёта delay, (б) задать длительность
   * stub-анимации внешнего span'а, на которую AnimatePresence ждёт
   * перед монтированием следующей фразы.
   */
  const { groups, total } = useMemo(() => {
    const segs = word.split(/(\s+)/);
    let g = 0;
    const res: Array<
      | { type: "space"; key: string; text: string }
      | { type: "word"; key: string; letters: Array<{ ch: string; idx: number }> }
    > = [];
    segs.forEach((seg, si) => {
      if (seg === "") return;
      if (/^\s+$/.test(seg)) {
        res.push({ type: "space", key: `s-${si}`, text: seg });
      } else {
        const chars = Array.from(seg);
        const letters = chars.map((ch) => ({ ch, idx: g++ }));
        res.push({ type: "word", key: `w-${si}`, letters });
      }
    });
    return { groups: res, total: g };
  }, [word]);

  /**
   * Один общий className.
   *
   * Tracking подняли с `-0.03em` до `0.01em` — на латинице разница почти
   * незаметна, но русские слова («Фокусируйтесь», «Создавайте») перестали
   * слипаться: кириллица оптически плотнее, чем латиница того же кегля,
   * и от плотного `tracking` соседние «и/й/ц/щ» сливались в чернильный мазок.
   *
   * `max-w-[16ch]` чуть шире прежнего (14ch) — даёт длинным фразам
   * («Фокусируйтесь на главном») место для красивого balance-wrap.
   */
  const className =
    "block max-w-[16ch] text-balance text-center text-[clamp(36px,5vw,72px)] font-black leading-[1.05] tracking-[0.01em] text-white drop-shadow-[0_4px_40px_rgba(0,0,0,0.35)]";

  if (reduced) {
    return <span className={className}>{words[0]}</span>;
  }

  // Длительность «stub»-анимации внешнего span'а: AnimatePresence
  // ждёт её завершения перед тем, как смонтировать новую фразу.
  // Делается равной максимальной задержке последней буквы + её duration,
  // плюс крохотный fudge на «безопасность».
  const exitGuard = Math.max(0, total - 1) * 0.016 + 0.4 + 0.05;

  return (
    <span
      // Озвучка для скринридеров: меняющийся текст на буквах оглушает,
      // поэтому даём общий aria-label на контейнере и прячем буквы.
      className="relative inline-flex items-center justify-center"
      aria-live="polite"
      aria-atomic="true"
      aria-label={word}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={word + ":" + index}
          // Stub-анимация без визуального эффекта (opacity 1 → 1),
          // нужна ТОЛЬКО чтобы AnimatePresence удерживала старый
          // motion.span смонтированным `exitGuard` секунд — пока
          // все буквы внутри не закончат свои exit'ы.
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1, transition: { duration: exitGuard } }}
          className={className}
        >
          {groups.map((grp) => {
            if (grp.type === "space") {
              // Пробел — обычный текстовый узел в собственном span'е.
              // Это естественная «точка переноса строки» для браузера.
              return <span key={grp.key}>{grp.text}</span>;
            }
            return (
              // Word-wrapper. `inline-block` + `whitespace-nowrap` —
              // классическая комбинация против внутрисловного переноса.
              <span
                key={grp.key}
                className="inline-block whitespace-nowrap"
              >
                {grp.letters.map((l) => (
                  <motion.span
                    key={`${grp.key}-${l.idx}-${l.ch}`}
                    // ── АНИМАЦИЯ БУКВЫ ──
                    // Без blur'а — пользователю не нравилось «таяние».
                    // Вход: edge приподнимается на 0.55em снизу
                    // + микро-scale 0.94 → 1. Stagger по глобальному
                    // индексу буквы: 22мс между соседями + 40мс
                    // delayChildren-overhead.
                    initial={{ opacity: 0, y: "0.55em", scale: 0.94 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: {
                        duration: 0.55,
                        ease: [0.22, 1, 0.36, 1],
                        delay: 0.04 + l.idx * 0.022,
                      },
                    }}
                    // Выход обратным порядком: фраза «сдувается»
                    // с конца. 16мс между соседями — чуть бодрее
                    // входа, что характерно для качественной motion
                    // школы (Apple/Vercel-like).
                    exit={{
                      opacity: 0,
                      y: "-0.45em",
                      scale: 0.97,
                      transition: {
                        duration: 0.4,
                        ease: [0.22, 1, 0.36, 1],
                        delay: (total - 1 - l.idx) * 0.016,
                      },
                    }}
                    className="inline-block will-change-transform"
                    aria-hidden
                  >
                    {l.ch}
                  </motion.span>
                ))}
              </span>
            );
          })}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function AuthShaderHero() {
  const { t } = useI18n();
  const a = t.auth;

  return (
    // Раньше было `hidden lg:block` — сейчас шейдер всегда отрисовывается
    // и растягивается на весь viewport (`absolute inset-0`), а форма
    // плавает НАД ним как glass-панель. `aria-hidden` остаётся:
    // всё содержимое (фон, морфинг, tagline) — декоративное,
    // интерактивного внутри больше нет (JULOW-лого живёт в AuthShell).
    // Обёртка нужна, чтобы поверх общего бэкграунда лежали
    // auth-специфичные оверлеи (правый form-mask, вертикальный
    // виньет, морфинг-надпись, tagline). Сам художественный
    // шейдер переёхал в общий компонент `JulowShader`, который
    // используется и на Hero лендинга.
    <aside
      aria-hidden
      className="absolute inset-0 overflow-hidden"
    >
      <JulowShader />

      {/* 5. ПРАВАЯ МАСКА под фон формы — широкий мягкий градиент
          (~35% вместо бывших 14%) с промежуточным stop'ом, чтобы
          переход между шейдером и формой воспринимался как мягкий
          «туман», а не резкий вертикальный «шов». Два stop'а
          background→background/60 дают «хвостик» easing'а в самом
          конце — выглядит больше как fog, чем линейный ramp. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(270deg, var(--background) 0%, color-mix(in oklch, var(--background) 78%, transparent) 12%, color-mix(in oklch, var(--background) 40%, transparent) 28%, transparent 46%, transparent 100%)",
        }}
      />

      {/* 5b. БОКОВЫЕ «КРЫЛЬЯ» тени — вертикальный vignette вверху и
          внизу, чтобы верхняя «JULOW»-надпись и tagline внизу читались
          при любой яркости лучей. Мягкий чёрный альфа-overlay без
          темных пятен по центру. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 22%, transparent 78%, rgba(0,0,0,0.20) 100%)",
        }}
      />

      {/* 6. ЦЕНТРАЛЬНАЯ МОРФИНГ-НАДПИСЬ.
          На lg+ «прижимаем» контейнер к ЛЕВОЙ части вьюпорта
          (`lg:right-[42%]`), чтобы морфинг не «лез» под плавающую
          форму справа. На мобильном/планшете (`< lg`) — по центру
          вьюпорта, под формой (форма там по центру экрана). */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 lg:right-[42%]">
        <MorphingWord />
      </div>

      {/* 7. TAGLINE + SUBLINE снизу-слева.
          Скрываем на `< md`: на мелких экранах glass-панель с формой
          занимает почти весь viewport, и ботн-левый блок либо
          оказался бы под панелью (не виден), либо зажимал высоту
          формы. Оставляем только на md+. */}
      <div className="relative z-10 hidden h-full flex-col justify-end p-10 md:flex xl:p-14">
        <div className="max-w-md">
          <p className="m-0 text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.35)] xl:text-[32px]">
            {a.heroTagline}
          </p>
          <p className="m-0 mt-3 text-[15px] font-medium leading-snug text-white/80 drop-shadow-[0_1px_10px_rgba(0,0,0,0.35)]">
            {a.heroSubline}
          </p>
        </div>
      </div>
    </aside>
  );
}
