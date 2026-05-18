"use client";

/**
 * JulowShader — общий «синусоидально-световой» бэкграунд для
 * страниц авторизации (login/signup). На лендинг-Hero используется
 * другой шейдер — см. `JulowHeroShader` в `julow-hero-shader.tsx`,
 * который рендерит WebGL-«swirled lenses» через `@paper-design/
 * shaders-react`.
 *
 * Здесь же — лёгкая CSS-реализация (без WebGL и сторонних либ),
 * которая нам отлично подходит за формой логина: даёт мягкое
 * «дышащее» движение света без перегрузки GPU и без вспышек на
 * первом пейнте. Работает в SSR без особенностей.
 *
 * Слои сверху вниз:
 *   1. Базовый диагональный градиент (violet → cobalt).
 *   2. Широкие диагональные «лучи» с большим blur'ом + контр-лучи,
 *      идущие в обратную сторону со своей фазой → ощущение «двух
 *      слоёв света».
 *   3. Тёплый солнечный блик (cream/peach) сверху-справа и холодный
 *      (azure) снизу-слева — дышат со своими таймингами.
 *   4. Тонкий film-grain через inline-SVG noise, blended `soft-light`,
 *      чтобы рендер «не звенел» на плотных градиентах.
 *
 * Все анимации — через `motion-safe:` Tailwind-варианты, поэтому
 * автоматически глушатся на `prefers-reduced-motion: reduce`.
 *
 * Как использовать: оберните `<JulowShader />` в `relative
 * overflow-hidden` родителя и положите контент рядом с `relative z-10`.
 * Сам компонент — `absolute inset-0 aria-hidden` (чистый декор).
 */

const NOISE_DATA_URI =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>" +
  "<feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.10 0'/></filter>" +
  "<rect width='100%' height='100%' filter='url(%23n)'/></svg>";

export function JulowShader({ className = "" }: { className?: string } = {}) {
  return (
    <aside
      aria-hidden
      className={["absolute inset-0 overflow-hidden", className].join(" ").trim()}
    >
      {/* 1. БАЗОВЫЙ ГРАДИЕНТ */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #1c2bff 0%, #3d39e8 35%, #5b3df0 60%, #7c5af5 80%, #b69bff 100%)",
        }}
      />

      {/* 2a. ОСНОВНЫЕ ЛУЧИ — широкие, ярко-белые, заметно РАЗМЫТЫЕ.
          `filter: blur(...)` сглаживает кромки повторений до состояния
          мягких лучей. `inset-[-30%]` + `200% 200%` background-size
          даёт длинный путь для анимации без видимого re-tile в краях.
          90с цикл — медленный, чтобы лучи не мельтешили. */}
      <div
        aria-hidden
        className="absolute inset-[-30%] motion-safe:animate-[julow-bars_90s_linear_infinite]"
        style={{
          backgroundImage: [
            "repeating-linear-gradient(115deg, transparent 0 160px, rgba(255,255,255,0.14) 160px 230px, transparent 230px 420px)",
            "repeating-linear-gradient(115deg, transparent 0 260px, rgba(18,12,90,0.22) 260px 340px, transparent 340px 520px)",
          ].join(", "),
          backgroundSize: "200% 200%",
          filter: "blur(28px)",
          willChange: "background-position",
        }}
      />

      {/* 2b. КОНТР-ЛУЧИ — тонкие, более прозрачные, идут в обратную сторону
          и со своей скоростью (110с). Дают ощущение «двух слоёв света»,
          какое есть у настоящего шейдера, без эффекта монотонного скролла. */}
      <div
        aria-hidden
        className="absolute inset-[-30%] mix-blend-screen motion-safe:animate-[julow-bars-reverse_110s_linear_infinite]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, transparent 0 90px, rgba(255,255,255,0.08) 90px 130px, transparent 130px 240px)",
          backgroundSize: "200% 200%",
          filter: "blur(14px)",
          willChange: "background-position",
        }}
      />

      {/* 3a. ТЁПЛЫЙ СОЛНЕЧНЫЙ БЛИК — кремово-розовый «закат» сверху-справа. */}
      <div
        aria-hidden
        className="absolute inset-0 motion-safe:animate-[julow-sun_14s_ease-in-out_infinite_alternate]"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 88% 8%, rgba(255, 238, 220, 0.55) 0%, rgba(255, 200, 180, 0.30) 25%, rgba(180, 140, 230, 0.10) 55%, transparent 75%)",
          filter: "blur(10px)",
        }}
      />

      {/* 3b. ХОЛОДНЫЙ КОНТР-БЛИК слева-снизу — голубоватый, чтобы шейдер
          не выглядел односторонним. Дышит со своей фазой (16с). */}
      <div
        aria-hidden
        className="absolute inset-0 motion-safe:animate-[julow-sun-cool_16s_ease-in-out_infinite_alternate]"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 8% 92%, rgba(140, 170, 255, 0.30) 0%, rgba(120, 110, 255, 0.18) 30%, transparent 70%)",
          filter: "blur(14px)",
        }}
      />

      {/* 4. ЗЕРНИСТЫЙ ШУМ — film-grain, blended `soft-light`,
          чтобы рендер «не звенел» на плотных градиентах. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60 mix-blend-soft-light"
        style={{
          backgroundImage: `url("${NOISE_DATA_URI}")`,
          backgroundSize: "240px 240px",
        }}
      />
    </aside>
  );
}
