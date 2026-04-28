"use client";

import type { Translations } from "@/i18n/translations";
import {
  BubbleChatIcon,
  CheckmarkCircle02Icon,
  SparklesIcon,
  Task01Icon,
  WorkflowSquare01Icon,
} from "hugeicons-react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useMemo, useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

type LandingCopy = Translations["landing"];

const HERO_VIDEO_SRC =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_LANDING_HERO_VIDEO
    ? process.env.NEXT_PUBLIC_LANDING_HERO_VIDEO
    : "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export function LandingHeroScrollCinema({ L }: { L: LandingCopy }) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-4 sm:px-8 sm:pb-24">
        <div className="relative aspect-video w-full overflow-hidden rounded-[1.25rem] bg-black/20 shadow-2xl ring-1 ring-white/10">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={HERO_VIDEO_SRC}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/5" aria-hidden />
        </div>
        <span className="sr-only">{L.heroVideoAria}</span>
        <div className="mx-auto mt-16 max-w-2xl space-y-6 text-center">
          <h2 className="m-0 text-2xl font-black tracking-tight sm:text-3xl">
            {L.storyScrollPanelTitle}
          </h2>
          <p className="m-0 text-[var(--muted)]">{L.storyScrollPanelBody}</p>
        </div>
        <StoryBeatsStatic L={L} />
      </div>
    );
  }

  return (
    <>
      <UnifiedCinema L={L} />
      <ScrollBeats L={L} />
      <BridgeToBento L={L} />
    </>
  );
}

/* ── Cinematic horizontal scroll ──────────────────────────────────
 * GSAP ScrollTrigger pins the section and converts vertical scroll
 * into horizontal progress. The video grows from compact to large,
 * then the reveal panel slides in from the right.
 * ─────────────────────────────────────────────────────────────── */
function UnifiedCinema({ L }: { L: LandingCopy }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const frameBorderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=2500",
          pin: trackRef.current,
          scrub: 1.2,
          anticipatePin: 1,
        },
      });

      /* Phase 1 (0–0.4): Video grows from compact to large */
      tl.fromTo(
        videoRef.current,
        { width: "48vw", height: "28vh", borderRadius: 24 },
        { width: "62vw", height: "60vh", borderRadius: 18, ease: "power2.out" },
        0,
      );

      /* Glow intensifies as video grows */
      tl.fromTo(
        glowRef.current,
        { opacity: 0.1 },
        { opacity: 0.5, ease: "power1.inOut" },
        0,
      );

      /* Frame border fades */
      tl.fromTo(
        frameBorderRef.current,
        { opacity: 0.5 },
        { opacity: 0.12, ease: "power1.out" },
        0,
      );

      /* Scroll hint fades out early */
      tl.to(hintRef.current, { opacity: 0, duration: 0.15, ease: "power1.in" }, 0.05);

      /* Phase 2 (0.4–0.7): Panel slides in from right */
      tl.fromTo(
        panelRef.current,
        { x: 500, opacity: 0 },
        { x: 0, opacity: 1, ease: "power3.out", duration: 0.35 },
        0.4,
      );

      /* Video slightly shrinks to make room for panel */
      tl.to(
        videoRef.current,
        { width: "52vw", height: "52vh", borderRadius: 20, ease: "power2.inOut", duration: 0.35 },
        0.4,
      );

      /* Glow settles */
      tl.to(glowRef.current, { opacity: 0.3, ease: "power1.inOut", duration: 0.3 }, 0.5);

      /* Phase 3 (0.7–1): Panel content staggers in */
      const panelItems = panelRef.current?.querySelectorAll(".panel-reveal");
      if (panelItems) {
        panelItems.forEach((el, i) => {
          tl.fromTo(
            el,
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, ease: "power2.out", duration: 0.12 },
            0.65 + i * 0.06,
          );
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={sectionRef} className="relative w-full">
      <div
        ref={trackRef}
        className="flex h-dvh w-full items-center justify-center overflow-hidden px-4 sm:px-6"
      >
        {/* Ambient glow */}
        <div
          ref={glowRef}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ opacity: 0.1 }}
          aria-hidden
        >
          <div
            className="h-[min(88vh,880px)] w-[min(94vw,1240px)] rounded-[2rem] blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse 56% 54% at 50% 48%, oklch(62% 0.22 253 / 0.5) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative z-1 flex w-full max-w-[1680px] flex-col items-center justify-center gap-6 md:flex-row md:items-center md:justify-center md:gap-8">
          {/* Video frame */}
          <div
            ref={videoRef}
            className="relative z-1 shrink-0 overflow-hidden shadow-2xl"
            style={{
              width: "48vw",
              height: "28vh",
              borderRadius: 24,
              boxShadow:
                "0 28px 72px -20px oklch(18% 0 0 / 0.42), 0 10px 36px -12px oklch(18% 0 0 / 0.28)",
            }}
          >
            <div
              ref={frameBorderRef}
              className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/18"
              style={{ opacity: 0.5 }}
              aria-hidden
            />
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={HERO_VIDEO_SRC}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/42 via-transparent to-white/[0.07]"
              aria-hidden
            />
          </div>

          <span className="sr-only">{L.heroVideoAria}</span>

          {/* Reveal panel */}
          <div
            ref={panelRef}
            className="relative z-2 w-[min(92vw,440px)] md:mt-0 md:w-[min(36vw,480px)]"
            style={{ opacity: 0 }}
          >
            <RevealPanelStatic L={L} />
          </div>
        </div>

        {/* Scroll hint */}
        <div
          ref={hintRef}
          className="pointer-events-none absolute bottom-7 left-1/2 z-3 flex -translate-x-1/2 flex-col items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-white/85 mix-blend-difference"
          aria-hidden
        >
          <span>{L.storyScrollHint}</span>
          <motion.span
            className="h-6 w-px bg-current"
            animate={{ scaleY: [0.35, 1, 0.35], originY: 1 }}
            transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Reveal panel (static, GSAP animates .panel-reveal children) ── */
function RevealPanelStatic({ L }: { L: LandingCopy }) {
  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-[var(--border)]/60 bg-[var(--surface)]/82 p-6 shadow-2xl backdrop-blur-2xl sm:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full opacity-60 blur-3xl"
        style={{ background: "oklch(62% 0.22 253 / 0.35)" }}
      />

      <div className="panel-reveal">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
          <span className="h-1 w-1 rounded-full bg-accent" />
          {L.storyScrollPanelKicker}
        </span>
      </div>

      <h2 className="panel-reveal m-0 mt-4 text-[1.75rem] font-black leading-[1.05] tracking-[-0.025em] sm:text-4xl">
        <span className="block text-[var(--foreground)]">{L.storyScrollPanelTitle}</span>
        <span className="mt-2 flex items-center gap-2">
          <motion.span
            className="inline-block text-[2.5rem] leading-none sm:text-[3rem]"
            animate={{ rotate: [0, 12, -8, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          >
            ✨
          </motion.span>
          <motion.span
            className="inline-block text-[2.5rem] leading-none sm:text-[3rem]"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          >
            🤝
          </motion.span>
        </span>
      </h2>

      <p className="panel-reveal m-0 mt-3 text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
        {L.storyScrollPanelBody}
      </p>

      <div className="panel-reveal mt-5 grid grid-cols-3 gap-2">
        {[
          { I: SparklesIcon, l: "Signal", c: "oklch(62% 0.22 253)" },
          { I: BubbleChatIcon, l: "Context", c: "oklch(70% 0.18 150)" },
          { I: WorkflowSquare01Icon, l: "Flow", c: "oklch(62% 0.22 300)" },
        ].map(({ I, l, c }, i) => (
          <motion.div
            key={l}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border)]/60 bg-[var(--surface)]/70 p-3"
            animate={{ y: [0, -3, 0] }}
            transition={{
              duration: 2.8 + i * 0.3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: `color-mix(in oklch, ${c} 18%, transparent)`, color: c }}
            >
              <I size={16} strokeWidth={1.8} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {l}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── Scroll-linked story beats ─────────────────────────────────────
 * Two beats; each one parallaxes its visual based on its own rect
 * position relative to the viewport.  Text stays crisp and fades in
 * from the side; visual drifts vertically + scales as the row passes.
 * ────────────────────────────────────────────────────────────────── */
function ScrollBeats({ L }: { L: LandingCopy }) {
  return (
    <div className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
      <BeatRow
        side="right"
        title={L.storyBeat1Title}
        body={L.storyBeat1Body}
        tagline={L.storyBeatTagline}
        visual={<BeatVizKanban liveLabel={L.storyVizLive} />}
      />
      <div className="h-20 sm:h-32" />
      <BeatRow
        side="left"
        title={L.storyBeat2Title}
        body={L.storyBeat2Body}
        tagline={L.storyBeatTagline}
        visual={<BeatVizChat focusLabel={L.storyVizFocus} />}
      />
    </div>
  );
}

function BeatRow({
  side,
  title,
  body,
  tagline,
  visual,
}: {
  side: "left" | "right";
  title: string;
  body: string;
  tagline: string;
  visual: React.ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const vizWrapRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      /* Text entrance */
      gsap.fromTo(
        textRef.current,
        { opacity: 0, x: side === "right" ? -28 : 28 },
        {
          opacity: 1,
          x: 0,
          ease: "power3.out",
          scrollTrigger: {
            trigger: rowRef.current,
            start: "top 80%",
            once: true,
          },
        },
      );

      /* Visual parallax + 3D tilt */
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rowRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 1.5,
        },
      });

      tl.fromTo(
        vizRef.current,
        { y: 52, scale: 0.94, rotateY: side === "right" ? 5 : -5 },
        { y: -52, scale: 1.04, rotateY: side === "right" ? -5 : 5, ease: "none" },
        0,
      );

      tl.fromTo(
        vizRef.current,
        { scale: 1.04 },
        { scale: 0.98, ease: "none", duration: 0.5 },
        0.5,
      );

      tl.fromTo(
        glowRef.current,
        { opacity: 0.18 },
        { opacity: 0.55, ease: "power1.inOut", duration: 0.45 },
        0,
      );

      tl.to(glowRef.current, { opacity: 0.22, ease: "power1.inOut", duration: 0.55 }, 0.45);
    }, rowRef);

    return () => ctx.revert();
  }, [side]);

  return (
    <div
      ref={rowRef}
      className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20"
    >
      <div
        ref={textRef}
        className={side === "left" ? "order-2" : ""}
      >
        <h3 className="m-0 text-3xl font-black tracking-[-0.02em] sm:text-4xl">{title}</h3>
        <p className="mt-4 m-0 text-base leading-relaxed text-[var(--muted)] sm:text-lg">{body}</p>
        <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-accent">
          <CheckmarkCircle02Icon size={16} strokeWidth={2} />
          <span>{tagline}</span>
        </div>
      </div>
      <div
        ref={vizWrapRef}
        className={`relative ${side === "left" ? "order-1" : ""}`}
        style={{ perspective: 1400 }}
      >
        <div
          ref={glowRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] blur-3xl"
          style={{
            background:
              side === "right"
                ? "radial-gradient(ellipse 70% 80% at 60% 50%, oklch(62% 0.22 253 / 0.4), transparent 70%)"
                : "radial-gradient(ellipse 70% 80% at 40% 50%, oklch(70% 0.18 150 / 0.4), transparent 70%)",
            opacity: 0.18,
          }}
        />
        <div
          ref={vizRef}
          style={{ transformStyle: "preserve-3d" }}
        >
          {visual}
        </div>
      </div>
    </div>
  );
}

/* ── Interactive kanban viz ──────────────────────────────────────── */
function BeatVizKanban({ liveLabel }: { liveLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "-30%" });

  const cols = useMemo(
    () => [
      { name: "Backlog", c: "oklch(62% 0.02 260)", items: 3 },
      { name: "Active", c: "oklch(62% 0.22 253)", items: 4 },
      { name: "Shipped", c: "oklch(70% 0.19 150)", items: 5 },
    ],
    [],
  );

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-3xl border border-[var(--border)]/70 bg-[var(--surface)]/85 p-5 shadow-2xl backdrop-blur-xl sm:p-6"
    >
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Task01Icon size={14} strokeWidth={2} />
          </div>
          <div>
            <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Sprint 14
            </p>
            <p className="m-0 text-xs font-semibold text-[var(--foreground)]">Julow Web</p>
          </div>
        </div>
        <div className="flex -space-x-1.5">
          {["oklch(62% 0.22 300)", "oklch(70% 0.17 72)", "oklch(62% 0.19 253)"].map((c, i) => (
            <div
              key={i}
              className="h-6 w-6 rounded-full ring-2 ring-[var(--surface)]"
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* Board */}
      <div className="grid grid-cols-3 gap-2">
        {cols.map((col, ci) => (
          <div key={col.name} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 px-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: col.c }} />
              <span className="truncate text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
                {col.name}
              </span>
              <span className="ml-auto text-[9px] font-semibold text-[var(--muted)]/60">
                {col.items}
              </span>
            </div>
            {Array.from({ length: col.items }, (_, i) => {
              const key = `${col.name}-${i}`;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                  transition={{ delay: 0.1 + ci * 0.1 + i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface)] p-2"
                  style={{ borderLeft: `2px solid ${col.c}` }}
                >
                  <div className="h-1.5 w-[78%] rounded-full bg-[var(--muted)]/30" />
                  <div className="mt-1.5 flex items-center gap-1">
                    <div className="h-1 flex-1 rounded-full bg-[var(--muted)]/20" />
                    <motion.div
                      className="h-3 w-3 rounded-full"
                      style={{ background: col.c }}
                      animate={inView && ci === 1 && i === 0 ? { scale: [1, 1.35, 1], opacity: [0.6, 1, 0.6] } : {}}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Live indicator */}
      <div className="mt-5 flex items-center justify-between rounded-xl border border-[var(--border)]/40 bg-[var(--surface-secondary)]/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(70%_0.19_150)] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[oklch(60%_0.19_150)]" />
          </span>
          <span className="text-xs font-semibold text-[var(--foreground)]">{liveLabel}</span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
          +3 today
        </span>
      </div>
    </div>
  );
}

/* ── Interactive chat viz ────────────────────────────────────────── */
function BeatVizChat({ focusLabel }: { focusLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "-30%" });

  const msgs = [
    { who: "MS", n: "Marina", c: "oklch(62% 0.22 300)", txt: "Hero flow is merged. Preview ready 🎉", self: false },
    { who: "ME", n: "You", c: "oklch(62% 0.19 253)", txt: "Checking it now — one pass and I'll ship.", self: true },
    { who: "DP", n: "Denis", c: "oklch(70% 0.17 72)", txt: "Analytics board looks sharp. 🔥", self: false },
  ];

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-3xl border border-[var(--border)]/70 bg-[var(--surface)]/85 p-5 shadow-2xl backdrop-blur-xl sm:p-6"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[oklch(70%_0.18_150_/_0.18)] text-[oklch(50%_0.18_150)]">
            <BubbleChatIcon size={14} strokeWidth={2} />
          </div>
          <div>
            <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              # product
            </p>
            <p className="m-0 text-xs font-semibold text-[var(--foreground)]">3 online</p>
          </div>
        </div>
        <div className="text-[10px] font-semibold text-[var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(60%_0.19_150)]" />
            Live
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-2.5">
        {msgs.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={inView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 12, scale: 0.94 }}
            transition={{ delay: 0.15 + i * 0.16, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`flex items-end gap-2 ${m.self ? "flex-row-reverse" : ""}`}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-[var(--surface)]"
              style={{ background: m.c }}
            >
              {m.who}
            </div>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12px] leading-snug ${m.self ? "bg-accent text-accent-foreground" : "border border-[var(--border)]/50 bg-[var(--surface)] text-[var(--foreground)]"}`}
            >
              {!m.self && <p className="m-0 mb-0.5 text-[9px] font-bold uppercase tracking-wider opacity-70">{m.n}</p>}
              <p className="m-0">{m.txt}</p>
            </div>
          </motion.div>
        ))}

        {/* Typing indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.15 + msgs.length * 0.16, duration: 0.4 }}
          className="flex items-center gap-2 pl-9"
        >
          <span className="text-[10px] font-semibold text-[var(--muted)]">Marina is typing</span>
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-[var(--muted)]"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
              />
            ))}
          </span>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-[var(--border)]/40 bg-[var(--surface-secondary)]/40 px-3 py-2">
        <Task01Icon size={13} strokeWidth={2} className="text-accent" />
        <span className="text-xs font-semibold text-[var(--foreground)]">{focusLabel}</span>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
          ∞ focus
        </span>
      </div>
    </div>
  );
}

/* ── Static fallback (reduced-motion users) ──────────────────────── */
function StoryBeatsStatic({ L }: { L: LandingCopy }) {
  return (
    <div className="mx-auto mt-16 max-w-6xl space-y-16 px-0">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div>
          <h3 className="m-0 text-2xl font-black">{L.storyBeat1Title}</h3>
          <p className="mt-3 m-0 text-[var(--muted)]">{L.storyBeat1Body}</p>
        </div>
        <div className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)]/80 p-6 shadow-xl">
          <div className="space-y-3">
            {["78%", "56%", "92%"].map((w, i) => (
              <div
                key={i}
                className="h-3 rounded-full bg-accent/70"
                style={{ width: w }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)]/80 p-6 shadow-xl">
          <p className="text-sm text-[var(--muted)]">Chat preview</p>
        </div>
        <div>
          <h3 className="m-0 text-2xl font-black">{L.storyBeat2Title}</h3>
          <p className="mt-3 m-0 text-[var(--muted)]">{L.storyBeat2Body}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Bridge into bento section (draw-on-scroll SVG via GSAP) ──────── */
function BridgeToBento({ L }: { L: LandingCopy }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!pathRef.current || !dotRef.current || !cardRef.current) return;

      /* Set initial states */
      gsap.set(pathRef.current, { strokeDasharray: pathRef.current.getTotalLength(), strokeDashoffset: pathRef.current.getTotalLength() });
      gsap.set(dotRef.current, { opacity: 0 });
      gsap.set(cardRef.current, { opacity: 0.35 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 85%",
          end: "center center",
          scrub: 1.2,
        },
      });

      tl.to(pathRef.current, { strokeDashoffset: 0, ease: "power1.inOut" }, 0);
      tl.to(dotRef.current, { opacity: 1, ease: "power1.in" }, 0.3);
      tl.to(cardRef.current, { opacity: 1, ease: "power1.inOut" }, 0.1);
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative mx-auto max-w-5xl px-5 pb-12 pt-4 sm:px-8 sm:pb-20">
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-[2rem] border border-[var(--border)]/60 bg-[var(--surface)]/70 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-12"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 50% 0%, oklch(62% 0.22 253 / 0.35), transparent 65%)",
          }}
          aria-hidden
        />

        <svg
          className="mx-auto mb-8 h-28 w-full max-w-md text-accent"
          viewBox="0 0 400 120"
          fill="none"
          aria-hidden
        >
          <path
            ref={pathRef}
            d="M 40 20 C 120 100, 280 100, 360 20"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle ref={dotRef} cx={200} cy={96} r={5} fill="currentColor" />
        </svg>

        <h3 className="relative z-1 m-0 text-2xl font-black tracking-[-0.02em] sm:text-4xl">
          {L.storyBridgeTitle}
        </h3>
        <p className="relative z-1 mx-auto mt-4 max-w-lg text-[var(--muted)] sm:text-lg">
          {L.storyBridgeBody}
        </p>
        <div className="relative z-1 mt-8">
          <Link
            href="#features"
            className="inline-flex items-center justify-center rounded-full bg-[var(--foreground)] px-6 py-3 text-sm font-semibold text-[var(--background)] ring-1 ring-[var(--border)]/30 transition-transform hover:scale-[1.03]"
          >
            {L.storyBridgeCta}
          </Link>
        </div>
      </div>
    </section>
  );
}
