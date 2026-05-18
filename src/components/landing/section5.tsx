/**
 * Section5 «Расписание / Ближайшие записи» — CTA на запись на встречу,
 * текст слева + изображение календаря справа.
 *
 * Мигрировано из `landing/app/components/section5.tsx`.
 */

"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { InView } from "@/components/landing/in-view";
import { ArrowRight01Icon, Calendar01Icon, Task01Icon } from "@hugeicons/core-free-icons";
import { useI18n } from "@/i18n/context";
import { HugeiconsIcon } from "@hugeicons/react";

const blurFadeVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

export function Section5() {
  const { t } = useI18n();
  const l = t.landingPage;
  return (
    <section id="section-schedule" className="relative bg-zinc-50 overflow-hidden">
      <div className="container mx-auto px-4 border border-t-0 border-b-0 border-zinc-200/80">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-20 py-16 md:py-24 items-center lg:max-w-6xl lg:mx-auto">
          <div className="flex flex-col justify-center lg:pl-8 relative z-10">
            <InView variants={blurFadeVariants} transition={{ duration: 0.5 }} viewOptions={{ once: true }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                </span>
                <p className="text-xs font-medium tracking-wide text-zinc-600 uppercase">{l.s5Badge}</p>
              </div>
            </InView>

            <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.1 }} viewOptions={{ once: true }}>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-zinc-900 leading-[1.1] mb-6">
                {l.s5TitleLine1}
                <br />
                <span className="text-sky-600 relative inline-block">
                  {l.s5TitleLine2}
                  <svg className="absolute -bottom-2 left-0 w-full h-3 text-sky-200 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="transparent" strokeLinecap="round" />
                  </svg>
                </span>
              </h2>
            </InView>

            <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.2 }} viewOptions={{ once: true }}>
              <p className="text-lg md:text-xl text-zinc-600 leading-relaxed mb-10 max-w-md">
                {l.s5Lead}
              </p>
            </InView>

            <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.3 }} viewOptions={{ once: true }}>
              <div className="flex flex-wrap items-center gap-4">
                <motion.a
                  href="/login"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-zinc-900 text-white text-sm font-medium rounded-full hover:bg-zinc-800 transition-all duration-300 hover:shadow-lg hover:shadow-zinc-900/20 group whitespace-nowrap"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <HugeiconsIcon icon={Calendar01Icon} size={20} />
                  {l.s5CtaMeetings}
                  <HugeiconsIcon icon={ArrowRight01Icon} size={18} className="transition-transform group-hover:translate-x-1" />
                </motion.a>

                <a
                  href="/schedule"
                  className="inline-flex items-center gap-2 px-6 py-4 text-zinc-600 text-sm font-medium hover:text-zinc-900 hover:bg-zinc-200/50 rounded-full transition-all duration-300 whitespace-nowrap group"
                >
                  <HugeiconsIcon icon={Task01Icon} size={20} className="group-hover:text-sky-600 transition-colors" />
                  {l.s5CtaRoadmap}
                </a>
              </div>
            </InView>
          </div>

          <motion.div
            className="relative w-full max-w-lg lg:ml-auto z-10 pt-10 lg:pt-0 lg:translate-x-8"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          >
            <InView variants={blurFadeVariants} transition={{ duration: 0.8, delay: 0.4 }} viewOptions={{ once: true }}>
              <div className="relative rounded-3xl overflow-hidden">
                <Image
                  src="/calendar.png"
                  alt="Календарь записей"
                  width={600}
                  height={700}
                  loading="lazy"
                  className="object-contain w-full h-auto mix-blend-multiply"
                />
              </div>
            </InView>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
