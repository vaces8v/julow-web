"use client";

import { LandingNav } from "@/components/landing/landing-nav";
import { ShaderBG } from "@/components/landing/shader-bg";
import { useI18n } from "@/i18n/context";
import {
  ArrowRight01Icon, BubbleChatIcon, Call02Icon, CheckmarkCircle02Icon,
  Folder02Icon, PlayIcon, SparklesIcon, Task01Icon, WorkflowSquare01Icon,
} from "hugeicons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

export function MarketingLanding() {
  const { t } = useI18n();
  const router = useRouter();
  const L = t.landing;
  const reduce = useReducedMotion();

  if (reduce) return <MarketingLandingStatic L={L} router={router} />;

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none fixed inset-0 -z-20" aria-hidden>
        <ShaderBG className="h-full w-full opacity-80" />
      </div>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 opacity-[0.35] dark:opacity-[0.25]"
        style={{ backgroundImage: `linear-gradient(to right, color-mix(in oklch, var(--foreground) 7%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 7%, transparent) 1px, transparent 1px)`, backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse 80% 70% at 50% 20%, black 40%, transparent 90%)", WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 20%, black 40%, transparent 90%)" }}
      />
      <LandingNav L={L} />
      <HeroCinematic L={L} router={router} />
      <LogoMarquee L={L} />
      <JourneySection L={L} />
      <ServicesSection L={L} />
      <StatsSection L={L} />
      <QuoteSection L={L} />
      <FinalCta L={L} router={router} />
      <footer className="relative border-t border-[var(--border)]/30 py-14">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-5 text-center sm:flex-row sm:px-8 sm:text-left">
          <div>
            <p className="m-0 text-sm font-bold tracking-tight text-[var(--foreground)]">{L.footerTagline}</p>
            <p className="m-0 mt-1.5 text-xs text-[var(--muted)]">{L.footerCopy}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-[13px] font-medium text-[var(--muted)]">
            <Link href="/login" className="transition-all duration-300 hover:text-[var(--foreground)]">{L.navSignIn}</Link>
            <Link href="/register" className="transition-all duration-300 hover:text-[var(--foreground)]">{L.ctaStart}</Link>
            <Link href="/workspace" className="transition-all duration-300 hover:text-[var(--foreground)]">{L.navOpenApp}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   HERO — Full-screen pinned cinematic section
   ══════════════════════════════════════════════════════════════════ */
function HeroCinematic({ L, router }: { L: any; router: any }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const textContentRef = useRef<HTMLDivElement>(null);
  const titleARef = useRef<HTMLDivElement>(null);
  const titleBRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctasRef = useRef<HTMLDivElement>(null);
  const proofRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const entrance = gsap.timeline({ delay: 0.1 });
      entrance.fromTo(titleARef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out" });
      entrance.fromTo(titleBRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out" }, "-=0.65");
      entrance.fromTo(subRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, "-=0.5");
      entrance.fromTo(ctasRef.current, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, "-=0.35");
      entrance.fromTo(proofRef.current, { opacity: 0 }, { opacity: 1, duration: 0.6 }, "-=0.2");
      entrance.fromTo(videoRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "power3.out" }, "-=0.6");

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=1500",
          pin: trackRef.current,
          scrub: 1,
          anticipatePin: 1,
        }
      });

      // Text container goes up and fades out
      tl.to(textContentRef.current, { 
        y: "-35vh", 
        opacity: 0, 
        ease: "power2.inOut",
        duration: 0.6
      }, 0);

      // Video moves up and expands to fill the viewport with padding
      tl.to(videoRef.current, {
        y: "-30vh",
        width: "calc(100vw - 20px)",
        height: "calc(100vh - 20px)",
        borderRadius: 32,
        ease: "power2.inOut",
        duration: 1
      }, 0);

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const HERO_VIDEO_SRC = "/finish.mp4";

  return (
    <div ref={sectionRef} className="relative w-full">
      {/* Background images for light/dark mode */}
      <div className="absolute inset-0 -z-10 bg-[var(--background)] overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat dark:hidden" style={{ backgroundImage: "url('/light-bg.png')" }} />
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat hidden dark:block" style={{ backgroundImage: "url('/dark-bg.png')" }} />
      </div>

      <div ref={trackRef} className="flex min-h-dvh w-full flex-col items-center justify-start overflow-hidden px-5 pt-32 sm:px-8">
        
        {/* Text Content */}
        <div ref={textContentRef} className="relative z-10 flex w-full flex-col items-center justify-center text-center">
          <div className="relative max-w-4xl mx-auto" style={{ perspective: 1200 }}>
            <div ref={titleARef} className="overflow-hidden pb-1">
              <h1 className="m-0 text-[clamp(2.5rem,7vw,4.5rem)] font-bold leading-[1.05] tracking-[-0.03em]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
                <span className="block text-[var(--foreground)]">{L.heroTitleA}</span>
              </h1>
            </div>
            <div ref={titleBRef} className="overflow-hidden mt-1 pb-1">
              <h1 className="m-0 text-[clamp(2.5rem,7vw,4.5rem)] font-bold leading-[1.05] tracking-[-0.03em]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
                <span className="block bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, oklch(65% 0.2 260) 0%, oklch(62% 0.22 280) 50%, oklch(68% 0.18 240) 100%)" }}>{L.heroTitleB}</span>
              </h1>
            </div>
          </div>

          <p ref={subRef} className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-[var(--muted)] sm:text-[17px]">
            {L.heroSubtitle}
          </p>

          <div ref={ctasRef} className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button type="button" onClick={() => router.push("/register")} className="group relative flex h-[52px] min-w-[200px] items-center justify-center gap-2.5 overflow-hidden rounded-full bg-[var(--foreground)] px-8 text-[15px] font-bold text-[var(--background)] shadow-2xl shadow-black/20 transition-all hover:scale-[1.03] active:scale-[0.98] dark:shadow-white/10">
              <span className="relative z-10">{L.ctaStart}</span>
              <ArrowRight01Icon size={18} strokeWidth={2.5} className="relative z-10 transition-transform group-hover:translate-x-1" />
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-[800ms] group-hover:translate-x-full" aria-hidden />
            </button>
            <button type="button" onClick={() => router.push("/workspace")} className="group flex h-[52px] min-w-[200px] items-center justify-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-8 text-[15px] font-bold text-[var(--foreground)] backdrop-blur-xl transition-all hover:bg-[var(--surface)] hover:shadow-lg active:scale-[0.98]">
              <PlayIcon size={16} strokeWidth={2.5} className="text-accent transition-transform group-hover:scale-110" /><span>{L.ctaWorkspace}</span>
            </button>
          </div>

          <div ref={proofRef} className="mt-6 flex items-center justify-center gap-2 text-[12px] font-medium text-[var(--muted)]">
            <div className="flex -space-x-2">
              {["oklch(62% 0.22 300)", "oklch(70% 0.17 72)", "oklch(62% 0.19 253)", "oklch(70% 0.19 150)"].map((c, i) => (
                <div key={i} className="h-6 w-6 rounded-full ring-2 ring-[var(--background)]" style={{ background: c }} />
              ))}
            </div>
            <span className="ml-2">Trusted by calm teams</span>
          </div>
        </div>

        {/* Video Element */}
        <div ref={videoRef} className="relative z-20 mt-10 flex-shrink-0 overflow-hidden shadow-[0_32px_80px_-20px_rgba(0,0,0,0.5)]" style={{ width: "75vw", height: "55vh", borderRadius: 24, willChange: "transform, width, height, border-radius" }}>
          <video className="absolute inset-0 h-full w-full object-cover" src={HERO_VIDEO_SRC} autoPlay muted loop playsInline preload="metadata" />
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LOGO MARQUEE — Cinematic infinite scroll with fade masks
   ══════════════════════════════════════════════════════════════════ */
function LogoMarquee({ L }: { L: any }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!trackRef.current) return;
    const items = trackRef.current.querySelectorAll(".marquee-item");
    if (!items.length) return;
    const parent = trackRef.current;
    // Clone 3x for seamless loop
    for (let c = 0; c < 2; c++) items.forEach((item) => parent.appendChild(item.cloneNode(true)));
    const totalWidth = Array.from(items).reduce((w, el) => w + (el as HTMLElement).offsetWidth + 56, 0);
    gsap.to(parent, { x: -totalWidth, duration: 40, ease: "none", repeat: -1, modifiers: { x: gsap.utils.unitize((x: number) => x % totalWidth) } });

    // Fade-in on scroll
    if (sectionRef.current) {
      gsap.fromTo(sectionRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: sectionRef.current, start: "top 90%", once: true } });
    }
  }, []);

  const logos = ["Aperture", "Meridian", "Northfold", "Helix Labs", "Quanta", "Bright&Co", "Luminos", "Vortex"];
  return (
    <section ref={sectionRef} className="relative border-y border-[var(--border)]/30 py-12 backdrop-blur-sm" style={{ opacity: 0 }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--background)] via-transparent to-[var(--background)]" style={{ opacity: 0.5 }} />
      <p className="mb-7 text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--muted)]">{L.strip}</p>
      <div className="relative overflow-hidden" style={{ maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)" }}>
        <div ref={trackRef} className="flex items-center gap-14 whitespace-nowrap">
          {logos.map((n) => (
            <span key={n} className="marquee-item text-lg font-black tracking-tight text-[var(--foreground)] opacity-40 transition-opacity duration-300 hover:opacity-80" style={{ fontFamily: "var(--font-inter), sans-serif", letterSpacing: "-0.03em" }}>{n}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   JOURNEY SECTION — Cinematic scroll-triggered cards with 3D tilt
   ══════════════════════════════════════════════════════════════════ */
function JourneySection({ L }: { L: any }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Heading parallax entrance
      const headTl = gsap.timeline({ scrollTrigger: { trigger: sectionRef.current, start: "top 82%", once: true } });
      headTl.fromTo(headingRef.current?.querySelector(".kicker")!, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
      headTl.fromTo(headingRef.current?.querySelector("h2")!, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, "-=0.35");
      headTl.fromTo(headingRef.current?.querySelector("p")!, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, "-=0.4");

      // Cards stagger with 3D rotation
      const cards = cardsRef.current?.querySelectorAll(".journey-card");
      cards?.forEach((card, i) => {
        gsap.fromTo(card,
          { y: 100, opacity: 0, rotateX: 8, scale: 0.9 },
          { y: 0, opacity: 1, rotateX: 0, scale: 1, duration: 1, ease: "power3.out",
            scrollTrigger: { trigger: card, start: "top 88%", once: true }, delay: i * 0.12 }
        );
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const journeys = [
    { title: "Going Zero to One", desc: "Navigating a new venture or breaking into a new market. We guide you from concept to first paying customer.", color: "oklch(62% 0.22 253)", emoji: "🚀" },
    { title: "Scaling from One to N", desc: "Achieved product-market fit and scaling to new heights. Architecture that grows with your ambitions.", color: "oklch(70% 0.18 150)", emoji: "📈" },
    { title: "Need Quick Solutions", desc: "Know exactly what you want and need a team to step in fast. Ship in days, not months.", color: "oklch(62% 0.22 300)", emoji: "⚡" },
  ];

  return (
    <section ref={sectionRef} className="relative mx-auto max-w-7xl px-5 py-28 sm:px-8 sm:py-40" style={{ perspective: "1200px" }}>
      {/* Section ambient glow */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[120px]" style={{ background: "radial-gradient(circle, oklch(62% 0.22 253 / 0.4), transparent 70%)" }} />

      <div ref={headingRef} className="mx-auto mb-20 max-w-2xl text-center">
        <span className="kicker inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/8 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-accent shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />Where are you in your journey?
        </span>
        <h2 className="mt-6 m-0 text-4xl font-black tracking-[-0.03em] sm:text-[3.5rem] sm:leading-[1.05]">{L.bentoTitle}</h2>
        <p className="mx-auto mt-4 max-w-md text-[var(--muted)] text-base leading-relaxed">Choose your path. We adapt our approach to match where you are right now.</p>
      </div>
      <div ref={cardsRef} className="grid gap-6 md:grid-cols-3">
        {journeys.map((j, i) => (
          <div key={i} className="journey-card group relative overflow-hidden rounded-[2rem] border border-[var(--border)]/40 bg-[var(--surface)]/60 p-8 backdrop-blur-2xl transition-all duration-700 hover:border-[var(--border)]/80 hover:bg-[var(--surface)]/90 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] hover:-translate-y-1" style={{ transformStyle: "preserve-3d" }}>
            {/* Animated gradient border on hover */}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-700 group-hover:opacity-100" style={{ background: `linear-gradient(135deg, transparent 30%, ${j.color} 50%, transparent 70%)`, maskImage: "linear-gradient(black, black) content-box, linear-gradient(black, black)", WebkitMaskImage: "linear-gradient(black, black) content-box, linear-gradient(black, black)", maskComposite: "exclude", WebkitMaskComposite: "xor", padding: "1px", borderRadius: "inherit" }} />
            {/* Glow orb */}
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-0 blur-[80px] transition-opacity duration-700 group-hover:opacity-60" style={{ background: j.color }} />
            {/* Bottom glow */}
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100" style={{ background: `radial-gradient(ellipse 90% 50% at 50% 110%, color-mix(in oklch, ${j.color} 15%, transparent), transparent 60%)` }} />
            
            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <span className="text-[4.5rem] font-black leading-none tracking-[-0.06em] opacity-[0.08] transition-opacity duration-500 group-hover:opacity-[0.15]" style={{ color: j.color }}>0{i + 1}</span>
                <span className="text-3xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">{j.emoji}</span>
              </div>
              <h3 className="mt-3 m-0 text-[1.5rem] font-black tracking-tight leading-tight">{j.title}</h3>
              <p className="mt-3 m-0 text-[13.5px] leading-relaxed text-[var(--muted)]">{j.desc}</p>
              <div className="mt-7 flex items-center gap-2 text-[13px] font-bold transition-all duration-300 group-hover:gap-3" style={{ color: j.color }}>
                <span>Explore</span>
                <ArrowRight01Icon size={15} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-1.5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SERVICES — Cinematic numbered cards with hover glow
   ══════════════════════════════════════════════════════════════════ */
function ServicesSection({ L }: { L: any }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Heading stagger
      const headTl = gsap.timeline({ scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true } });
      headTl.fromTo(headingRef.current?.querySelector(".kicker")!, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" });
      headTl.fromTo(headingRef.current?.querySelector("h2")!, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, "-=0.3");
      headTl.fromTo(headingRef.current?.querySelector("p")!, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, "-=0.4");

      // Cards cinematic reveal
      const items = sectionRef.current?.querySelectorAll(".service-item");
      items?.forEach((item, i) => {
        gsap.fromTo(item,
          { y: 70, opacity: 0, scale: 0.92 },
          { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: "power3.out",
            scrollTrigger: { trigger: item, start: "top 90%", once: true }, delay: (i % 3) * 0.1 }
        );
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const services = [
    { num: "01", title: L.card1t, desc: L.card1d, icon: <Task01Icon size={24} strokeWidth={1.6} />, color: "oklch(62% 0.22 300)", tags: ["Focus Mode", "Today View", "Priority Queue"] },
    { num: "02", title: L.card2t, desc: L.card2d, icon: <Folder02Icon size={24} strokeWidth={1.6} />, color: "oklch(62% 0.22 253)", tags: ["Sprints", "Kanban", "Timeline"] },
    { num: "03", title: L.card3t, desc: L.card3d, icon: <BubbleChatIcon size={22} strokeWidth={1.6} />, color: "oklch(70% 0.18 150)", tags: ["Threads", "Reactions", "Integrations"] },
    { num: "04", title: L.card4t, desc: L.card4d, icon: <Call02Icon size={24} strokeWidth={1.6} />, color: "oklch(70% 0.18 200)", tags: ["Rooms", "Screen Share", "Recording"] },
    { num: "05", title: "AI-Powered", desc: "Smart suggestions, auto-summaries, and intelligent task orchestration", icon: <SparklesIcon size={24} strokeWidth={1.6} />, color: "oklch(62% 0.22 253)", tags: ["Assistants", "Automation", "Insights"] },
    { num: "06", title: "Workflow Engine", desc: "Custom automations that connect your tools and streamline processes", icon: <WorkflowSquare01Icon size={24} strokeWidth={1.6} />, color: "oklch(62% 0.22 300)", tags: ["Triggers", "Actions", "Templates"] },
  ];

  return (
    <section ref={sectionRef} className="relative overflow-hidden py-28 sm:py-40">
      {/* Full-width ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-0 h-full w-full opacity-30" style={{ background: "radial-gradient(ellipse 50% 40% at 20% 30%, oklch(62% 0.22 253 / 0.25), transparent 70%), radial-gradient(ellipse 40% 50% at 80% 70%, oklch(62% 0.22 300 / 0.2), transparent 70%)" }} />
      </div>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div ref={headingRef} className="mx-auto mb-20 max-w-2xl text-center">
          <span className="kicker inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/8 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-accent shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />{L.bentoLabel}
          </span>
          <h2 className="mt-6 m-0 text-4xl font-black tracking-[-0.03em] sm:text-[3.5rem] sm:leading-[1.05]">With our services</h2>
          <p className="mx-auto mt-4 max-w-lg text-[var(--muted)] text-base leading-relaxed">{L.bentoSub}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div key={s.num} className="service-item group relative overflow-hidden rounded-[2rem] border border-[var(--border)]/40 bg-[var(--surface)]/60 p-7 backdrop-blur-2xl transition-all duration-700 hover:border-[var(--border)]/80 hover:bg-[var(--surface)]/90 hover:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.3)] hover:-translate-y-1">
              {/* Glow orb */}
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full opacity-0 blur-[80px] transition-opacity duration-700 group-hover:opacity-50" style={{ background: s.color }} />
              {/* Bottom gradient glow */}
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100" style={{ background: `radial-gradient(ellipse 80% 40% at 50% 110%, color-mix(in oklch, ${s.color} 14%, transparent), transparent 60%)` }} />

              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  <span className="text-[2.2rem] font-black leading-none tracking-[-0.04em] opacity-[0.08] transition-opacity duration-500 group-hover:opacity-[0.2]" style={{ color: s.color }}>{s.num}</span>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-[var(--border)]/30 transition-all duration-500 group-hover:ring-[var(--border)]/60 group-hover:shadow-lg" style={{ background: `color-mix(in oklch, ${s.color} 12%, transparent)`, color: s.color }}>
                    {s.icon}
                  </div>
                </div>
                <h3 className="mt-5 m-0 text-xl font-bold tracking-tight">{s.title}</h3>
                <p className="mt-2.5 m-0 text-[13.5px] leading-relaxed text-[var(--muted)]">{s.desc}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {s.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-[var(--border)]/30 bg-[var(--surface)]/50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] transition-all duration-300 group-hover:border-[var(--border)]/50 group-hover:bg-[var(--surface)]/80">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   STATS — Cinematic counter animation with glowing cards
   ══════════════════════════════════════════════════════════════════ */
function StatsSection({ L }: { L: any }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const counters = statsRef.current?.querySelectorAll(".stat-number");
      counters?.forEach((el) => {
        const target = parseInt((el as HTMLElement).dataset.value || "0", 10);
        const suffix = (el as HTMLElement).dataset.suffix || "";
        gsap.fromTo(el, { innerText: "0" }, {
          innerText: target, duration: 2.5, ease: "power2.out", snap: { innerText: 1 },
          scrollTrigger: { trigger: sectionRef.current, start: "top 75%", once: true },
          onUpdate() { (el as HTMLElement).textContent = Math.round(gsap.getProperty(el, "innerText") as number) + suffix; },
        });
      });

      // Card stagger
      const cards = statsRef.current?.querySelectorAll(".stat-card");
      cards?.forEach((card, i) => {
        gsap.fromTo(card,
          { y: 50, opacity: 0, scale: 0.9 },
          { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "power3.out",
            scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true }, delay: i * 0.1 }
        );
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const stats = [
    { value: 99, suffix: ".98%", label: "Uptime", color: "oklch(70% 0.18 150)" },
    { value: 30, suffix: "ms", label: "UI latency", color: "oklch(62% 0.22 253)" },
    { value: 12, suffix: "+", label: "Integrations", color: "oklch(62% 0.22 300)" },
    { value: 3, suffix: "", label: "Languages", color: "oklch(70% 0.17 72)" },
  ];

  return (
    <section ref={sectionRef} className="relative mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-28">
      <div ref={statsRef} className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card group relative overflow-hidden rounded-[1.5rem] border border-[var(--border)]/40 bg-[var(--surface)]/60 p-7 text-center backdrop-blur-2xl transition-all duration-500 hover:border-[var(--border)]/70 hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.2)] hover:-translate-y-0.5">
            {/* Subtle glow */}
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: `radial-gradient(circle at 50% 20%, color-mix(in oklch, ${s.color} 18%, transparent), transparent 65%)` }} />
            <div className="relative z-10">
              <p className="stat-number m-0 text-[2.5rem] font-black tracking-[-0.02em] sm:text-[3rem]" data-value={s.value} data-suffix={s.suffix} style={{ color: s.color }}>0{s.suffix}</p>
              <p className="m-0 mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   QUOTE — Cinematic scroll-reveal testimonial
   ══════════════════════════════════════════════════════════════════ */
function QuoteSection({ L }: { L: any }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: sectionRef.current, start: "top 78%", once: true } });
      tl.fromTo(cardRef.current, { y: 80, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 1.1, ease: "power3.out" });
      tl.fromTo(cardRef.current?.querySelector(".quote-mark")!, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(2)" }, "-=0.6");
      tl.fromTo(cardRef.current?.querySelector("blockquote")!, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, "-=0.3");
      tl.fromTo(cardRef.current?.querySelector("figcaption")!, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, "-=0.3");
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative mx-auto max-w-6xl px-5 py-28 sm:px-8 sm:py-36">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15 blur-[100px]" style={{ background: "radial-gradient(circle, oklch(62% 0.22 253 / 0.5), transparent 65%)" }} />

      <figure ref={cardRef} className="relative mx-auto max-w-3xl overflow-hidden rounded-[2.5rem] border border-[var(--border)]/40 bg-[var(--surface)]/60 p-12 backdrop-blur-2xl sm:p-16" style={{ opacity: 0 }}>
        {/* Decorative orbs */}
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-25 blur-[80px]" style={{ background: "oklch(62% 0.22 253)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full opacity-20 blur-[60px]" style={{ background: "oklch(62% 0.22 300)" }} />

        <svg aria-hidden className="quote-mark mb-6 h-12 w-12 text-accent/50" viewBox="0 0 24 24" fill="currentColor"><path d="M9 7c-3.3 0-6 2.7-6 6v4h6v-4H6c0-1.7 1.3-3 3-3V7zm10 0c-3.3 0-6 2.7-6 6v4h6v-4h-3c0-1.7 1.3-3 3-3V7z" /></svg>
        <blockquote className="m-0 text-[1.35rem] font-semibold leading-[1.5] tracking-tight text-[var(--foreground)] sm:text-[1.75rem] sm:leading-[1.45]">{L.quote}</blockquote>
        <figcaption className="mt-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-[12px] font-black text-accent ring-2 ring-accent/20">M&amp;E</div>
          <div>
            <span className="text-sm font-bold text-[var(--foreground)]">{L.quoteMeta}</span>
          </div>
        </figcaption>
      </figure>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   FINAL CTA — Cinematic closing section with depth
   ══════════════════════════════════════════════════════════════════ */
function FinalCta({ L, router }: { L: any; router: any }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: sectionRef.current, start: "top 78%", once: true } });
      tl.fromTo(cardRef.current, { y: 80, opacity: 0, scale: 0.93 }, { y: 0, opacity: 1, scale: 1, duration: 1.1, ease: "power3.out" });
      tl.fromTo(cardRef.current?.querySelector("h3")!, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, "-=0.5");
      tl.fromTo(cardRef.current?.querySelector("p")!, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, "-=0.4");
      tl.fromTo(cardRef.current?.querySelector(".cta-buttons")!, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, "-=0.3");
      tl.fromTo(cardRef.current?.querySelector(".trust-badges")!, { opacity: 0 }, { opacity: 1, duration: 0.5 }, "-=0.15");
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative mx-auto max-w-6xl px-5 pb-28 sm:px-8 sm:pb-36">
      <div ref={cardRef} className="relative overflow-hidden rounded-[2.5rem] border border-[var(--border)]/40 px-8 py-20 text-center shadow-[0_32px_80px_-20px_rgba(0,0,0,0.25)] backdrop-blur-2xl sm:px-16 sm:py-24" style={{ opacity: 0, background: "linear-gradient(135deg, color-mix(in oklch, var(--surface) 90%, transparent), color-mix(in oklch, var(--surface) 70%, transparent) 50%, color-mix(in oklch, var(--surface-secondary) 60%, transparent))" }}>
        {/* Ambient glows */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 55% 55% at 50% 100%, oklch(62% 0.22 253 / 0.3), transparent 70%), radial-gradient(ellipse 45% 45% at 15% 0%, oklch(62% 0.22 300 / 0.2), transparent 70%), radial-gradient(ellipse 35% 35% at 85% 0%, oklch(70% 0.18 150 / 0.15), transparent 70%)" }} />
        {/* Grid overlay */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: `linear-gradient(to right, color-mix(in oklch, var(--foreground) 6%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 6%, transparent) 1px, transparent 1px)`, backgroundSize: "48px 48px", maskImage: "radial-gradient(ellipse 70% 80% at 50% 50%, black 20%, transparent 80%)", WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 50% 50%, black 20%, transparent 80%)" }} />

        <div className="relative z-10">
          <h3 className="m-0 text-[2rem] font-black tracking-[-0.03em] sm:text-[3.5rem] sm:leading-[1.05]">{L.finalTitle}</h3>
          <p className="mx-auto mt-5 max-w-md text-[var(--muted)] text-base leading-relaxed sm:text-lg">{L.finalSub}</p>
          <div className="cta-buttons mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button type="button" onClick={() => router.push("/register")} className="group relative flex h-[56px] min-w-[240px] items-center justify-center gap-2.5 overflow-hidden rounded-full bg-[var(--foreground)] px-8 text-[15px] font-bold text-[var(--background)] shadow-2xl shadow-black/25 transition-all hover:scale-[1.03] active:scale-[0.98] dark:shadow-white/10">
              <span className="relative z-10">{L.finalCta}</span>
              <ArrowRight01Icon size={18} strokeWidth={2.5} className="relative z-10 transition-transform group-hover:translate-x-1" />
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-[800ms] group-hover:translate-x-full" aria-hidden />
            </button>
            <button type="button" onClick={() => router.push("/workspace")} className="group flex h-[56px] min-w-[240px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-8 text-[15px] font-bold text-[var(--foreground)] backdrop-blur-xl transition-all hover:bg-[var(--surface)] hover:shadow-lg active:scale-[0.98]">
              {L.finalSecondary}
            </button>
          </div>
          <div className="trust-badges mt-10 flex flex-wrap items-center justify-center gap-6 text-[13px] text-[var(--muted)]">
            {["Free forever", "No credit card", "Setup in 60 sec"].map((s) => (
              <span key={s} className="inline-flex items-center gap-2 font-medium"><CheckmarkCircle02Icon size={15} strokeWidth={2} className="text-accent" />{s}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   STATIC FALLBACK — Reduced motion
   ══════════════════════════════════════════════════════════════════ */
function MarketingLandingStatic({ L, router }: { L: any; router: any }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none fixed inset-0 -z-20" aria-hidden><ShaderBG className="h-full w-full opacity-80" /></div>
      <LandingNav L={L} />
      <section className="relative mx-auto max-w-7xl px-5 pt-24 sm:px-8 sm:pt-32">
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="m-0 text-[2.85rem] font-black leading-[0.98] tracking-[-0.03em] sm:text-[5.2rem] sm:leading-[0.95]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
            <span className="block text-[var(--foreground)]">{L.heroTitleA}</span>
            <span className="block bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(120deg, oklch(62% 0.22 253) 0%, oklch(60% 0.22 290) 40%, oklch(70% 0.16 200) 75%, oklch(68% 0.18 253) 100%)" }}>{L.heroTitleB}</span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">{L.heroSubtitle}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => router.push("/register")} className="flex h-12 min-w-[220px] items-center justify-center gap-2 rounded-full bg-[var(--foreground)] px-7 text-[14px] font-semibold text-[var(--background)] shadow-xl">{L.ctaStart}</button>
            <button type="button" onClick={() => router.push("/workspace")} className="flex h-12 min-w-[220px] items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/60 px-7 text-[14px] font-semibold text-[var(--foreground)]">{L.ctaWorkspace}</button>
          </div>
        </div>
      </section>
      <section className="relative mx-auto max-w-5xl px-5 py-24 sm:px-8 sm:py-36">
        <h2 className="m-0 text-center text-4xl font-black tracking-[-0.02em] sm:text-5xl">{L.bentoTitle}</h2>
        <p className="mx-auto mt-4 max-w-lg text-center text-[var(--muted)]">{L.bentoSub}</p>
      </section>
      <section className="relative mx-auto max-w-6xl px-5 pb-24 sm:px-8 sm:pb-32">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-[var(--border)]/60 bg-[var(--surface)]/80 px-8 py-16 text-center backdrop-blur-xl sm:px-16 sm:py-20">
          <h3 className="m-0 text-3xl font-black tracking-[-0.02em] sm:text-5xl">{L.finalTitle}</h3>
          <p className="mx-auto mt-5 max-w-md text-[var(--muted)] sm:text-lg">{L.finalSub}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => router.push("/register")} className="flex h-12 min-w-[220px] items-center justify-center gap-2 rounded-full bg-[var(--foreground)] px-7 text-[14px] font-semibold text-[var(--background)]">{L.finalCta}</button>
          </div>
        </div>
      </section>
      <footer className="relative border-t border-[var(--border)]/50 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 text-center sm:flex-row sm:px-8 sm:text-left">
          <div><p className="m-0 text-sm font-bold tracking-tight text-[var(--foreground)]">{L.footerTagline}</p><p className="m-0 mt-1 text-xs text-[var(--muted)]">{L.footerCopy}</p></div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-medium text-[var(--muted)]">
            <Link href="/login" className="transition-colors hover:text-[var(--foreground)]">{L.navSignIn}</Link>
            <Link href="/register" className="transition-colors hover:text-[var(--foreground)]">{L.ctaStart}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

