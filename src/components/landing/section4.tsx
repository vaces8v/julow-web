/**
 * Section4 «Наши проекты» — карусель портфолио с автопрокруткой,
 * touch-swipe-управлением и индикаторами.
 *
 * Мигрировано из `landing/app/components/section4.tsx`. Импорты:
 *   - `framer-motion` → не используется (только React-state);
 *   - `@/components/ui/in-view` → `@/components/landing/in-view`.
 */

"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useRef, useMemo, type TouchEvent } from "react";
import { InView } from "@/components/landing/in-view";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { useI18n } from "@/i18n/context";

const blurFadeVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

export function Section4() {
  const { t } = useI18n();
  const l = t.landingPage;
  const projects = useMemo(
    () => [
      { id: 1, title: l.s4P1Title, category: l.s4P1Cat, image: "/section-1/image1.png", description: l.s4P1Desc },
      { id: 2, title: l.s4P2Title, category: l.s4P2Cat, image: "/section-1/image-bg2.png", description: l.s4P2Desc },
      { id: 3, title: l.s4P3Title, category: l.s4P3Cat, image: "/section-1/image-bg3.png", description: l.s4P3Desc },
      { id: 4, title: l.s4P4Title, category: l.s4P4Cat, image: "/section-1/image1.png", description: l.s4P4Desc },
    ],
    [l],
  );
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef(0);

  const next = useCallback(() => {
    setCurrent((p) => (p + 1) % projects.length);
  }, [projects.length]);

  const prev = useCallback(() => {
    setCurrent((p) => (p - 1 + projects.length) % projects.length);
  }, [projects.length]);

  useEffect(() => {
    if (!isPaused) {
      autoPlayRef.current = setInterval(next, 5000);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isPaused, next]);

  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) next();
    else if (diff < -50) prev();
  };

  return (
    <section id="section-portfolio" className="relative bg-zinc-50 overflow-hidden">
      <div className="container mx-auto px-4 border border-t-0 border-b-0 border-zinc-200/80 relative z-10">
        <div className="pt-20 md:pt-32 pb-12 md:pb-16 text-center">
          <InView variants={blurFadeVariants} transition={{ duration: 0.6 }} viewOptions={{ once: true }}>
            <p className="text-sm text-zinc-500 mb-6 tracking-wider uppercase">{l.s4Eyebrow}</p>
          </InView>
          <InView variants={blurFadeVariants} transition={{ duration: 0.7, delay: 0.1 }} viewOptions={{ once: true }}>
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold text-zinc-900 leading-[1.1] mb-8">
              {l.s4TitleLine1}
              <br />
              <span className="text-sky-600">{l.s4TitleLine2}</span>
            </h2>
          </InView>
          <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.2 }} viewOptions={{ once: true }}>
            <p className="text-xl md:text-2xl text-zinc-600 max-w-2xl mx-auto leading-relaxed">
              {l.s4Lead}
            </p>
          </InView>
        </div>

        <div className="pb-16 md:pb-32">
          <InView variants={blurFadeVariants} transition={{ duration: 0.7, delay: 0.3 }} viewOptions={{ once: true }}>
            <div
              className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              style={{ boxShadow: "0 30px 60px -12px rgba(0,0,0,0.2)" }}
            >
              <div
                className="flex transition-transform duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
                style={{ transform: `translateX(-${current * 100}%)` }}
              >
                {projects.map((project, index) => (
                  <div key={project.id} className="w-full shrink-0">
                    <div className="relative bg-zinc-900">
                      <div className="relative aspect-[3/4] sm:aspect-[4/3] md:aspect-video lg:aspect-[21/9] overflow-hidden">
                        <Image
                          src={project.image}
                          alt={project.title}
                          fill
                          sizes="100vw"
                          className="object-cover transition-transform duration-700"
                          priority={index === 0}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div
                          className="absolute inset-0"
                          style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)" }}
                        />
                        <div className="absolute top-4 sm:top-6 left-4 sm:left-6 z-10">
                          <span className="text-xs font-medium text-white/90 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full">
                            {project.category}
                          </span>
                        </div>
                        <div className="absolute top-4 sm:top-6 right-14 sm:right-16 z-10">
                          <span className="text-xs font-mono text-white/60">
                            {String(index + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}
                          </span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 md:p-10 z-10">
                          <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-2 sm:mb-3">
                            {project.title}
                          </h3>
                          <p className="text-sm sm:text-base md:text-lg text-white/70 max-w-xl leading-relaxed">
                            {project.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                aria-label={l.s4Prev}
                onClick={prev}
                className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-lg border border-white/20 flex items-center justify-center transition-all duration-200 active:scale-95"
              >
                <HugeiconsIcon icon={ArrowLeft02Icon} size={20} className="text-white" />
              </button>
              <button
                aria-label={l.s4Next}
                onClick={next}
                className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-lg border border-white/20 flex items-center justify-center transition-all duration-200 active:scale-95"
              >
                <HugeiconsIcon icon={ArrowRight02Icon} size={20} className="text-white" />
              </button>

              <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                {projects.map((_, i) => (
                  <button
                    key={i}
                    aria-label={`${l.s4Slide} ${i + 1}`}
                    onClick={() => setCurrent(i)}
                    className={`rounded-full transition-all duration-500 ${i === current ? "w-8 h-2 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/60"}`}
                  />
                ))}
              </div>
            </div>
          </InView>
        </div>
      </div>
    </section>
  );
}
