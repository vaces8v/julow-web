/**
 * Section1 «Почему выбирают нас» — grid из 3 image-карточек с in-view
 * stagger-анимацией.
 *
 * Мигрировано из `landing/app/components/section1.tsx`. Импорты:
 *   - `framer-motion` → `motion/react`;
 *   - `@/components/ui/in-view` → `@/components/landing/in-view`.
 */

"use client";

import Image from "next/image";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { InView } from "@/components/landing/in-view";
import { useI18n } from "@/i18n/context";

const blurFadeVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

export function Section1() {
  const { t } = useI18n();
  const l = t.landingPage;
  return (
    <section id="section-why" className="relative bg-zinc-50">
      <div className="container mx-auto px-4 border border-t-0 border-b-0 border-zinc-200/80">
        <div className="pt-16 md:pt-24 pb-8">
          <InView variants={blurFadeVariants} transition={{ duration: 0.5, ease: "easeOut" }} viewOptions={{ once: true, margin: "-50px" }}>
            <p className="text-sm text-zinc-500 mb-4">{l.s1Eyebrow}</p>
          </InView>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <InView variants={blurFadeVariants} transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} viewOptions={{ once: true, margin: "-50px" }}>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-zinc-900 leading-tight max-w-3xl">
                {l.s1Title}
              </h2>
            </InView>

            <InView variants={blurFadeVariants} transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }} viewOptions={{ once: true, margin: "-50px" }}>
              <div className="flex items-center gap-4 sm:gap-6 flex-wrap sm:flex-nowrap">
                <a
                  href="/#section-contact"
                  className="px-6 py-3 bg-zinc-900 text-white text-sm font-medium rounded-full hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
                >
                  {l.s1CtaDemo}
                </a>
                <p className="text-sm text-zinc-500 max-w-[200px]">
                  {l.s1CtaNote}
                </p>
              </div>
            </InView>
          </div>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-16 md:pb-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Card 1 */}
          <motion.div
            variants={itemVariants}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative group overflow-hidden rounded-3xl aspect-[4/5] md:aspect-auto md:h-[520px]"
          >
            <Image
              src="/section-1/image1.png"
              alt="Learn from mentors"
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute top-4 left-4">
              <span className="text-xs font-medium text-white/80 border border-white/30 px-3 py-1 rounded-full">01</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <InView variants={blurFadeVariants} transition={{ duration: 0.5, ease: "easeOut" }} viewOptions={{ once: true, margin: "-30px" }}>
                <p className="text-white/90 text-sm mb-3">{l.s1Card1Text}</p>
              </InView>
              <InView variants={blurFadeVariants} transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }} viewOptions={{ once: true, margin: "-30px" }}>
                <a
                  href="/login"
                  className="inline-flex items-center gap-2 text-xs font-medium text-white border border-white/40 hover:bg-white/10 px-4 py-2 rounded-full transition-all duration-300"
                >
                  {l.s1Card1Cta}
                  <HugeiconsIcon icon={ArrowRight02Icon} size={14} />
                </a>
              </InView>
            </div>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            variants={itemVariants}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative group overflow-hidden rounded-3xl aspect-[4/5] md:aspect-auto md:h-[520px]"
          >
            <Image
              src="/section-1/image-bg2.png"
              alt="Преимущества"
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute top-4 left-4">
              <span className="text-xs font-medium text-white/80 border border-white/30 px-3 py-1 rounded-full">02</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <InView variants={blurFadeVariants} transition={{ duration: 0.5, ease: "easeOut" }} viewOptions={{ once: true, margin: "-30px" }}>
                <div className="space-y-3">
                  {[
                    l.s1Card2I1,
                    l.s1Card2I2,
                    l.s1Card2I3,
                    l.s1Card2I4,
                  ].map((text, index) => (
                    <div key={index} className="flex items-center justify-between text-white border-b border-white/20 pb-2 last:border-0">
                      <span className="text-sm font-medium">{text}</span>
                      <HugeiconsIcon icon={ArrowRight02Icon} size={16} className="text-white/70" />
                    </div>
                  ))}
                </div>
              </InView>
            </div>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            variants={itemVariants}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative group overflow-hidden rounded-3xl aspect-[4/5] md:aspect-auto md:h-[520px]"
          >
            <Image
              src="/section-1/image-bg3.png"
              alt="Статистика"
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute top-4 left-4">
              <span className="text-xs font-medium text-white/80 border border-white/30 px-3 py-1 rounded-full">03</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <InView variants={blurFadeVariants} transition={{ duration: 0.5, ease: "easeOut" }} viewOptions={{ once: true, margin: "-30px" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-5xl md:text-6xl font-display font-bold text-white">{l.s1Card3Stat}</span>
                    <p className="text-sm text-white/80 mt-2 max-w-[200px]">
                      {l.s1Card3Text}
                    </p>
                  </div>
                  <HugeiconsIcon icon={ArrowRight02Icon} size={20} className="text-white/70 mt-2" />
                </div>
              </InView>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
