/**
 * Section3 «AI-боты и ассистенты» — описание AI-направления с
 * mirror-image робота слева и features-list справа.
 *
 * Мигрировано из `landing/app/components/section3.tsx`.
 */

"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { ArrowRight01Icon, Message01Icon, Calendar01Icon, UserIcon, AiPhoneIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { InView } from "@/components/landing/in-view";
import { useI18n } from "@/i18n/context";
import { useMemo } from "react";

const blurFadeVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

export function Section3() {
  const { t } = useI18n();
  const l = t.landingPage;
  const features = useMemo(
    () => [
      { icon: Calendar01Icon, text: l.s3Feat1 },
      { icon: UserIcon, text: l.s3Feat2 },
      { icon: AiPhoneIcon, text: l.s3Feat3 },
    ],
    [l],
  );
  return (
    <section id="section-ai" className="relative bg-zinc-50 overflow-hidden">
      <div className="container mx-auto px-4 border border-t-0 border-b-0 border-zinc-200/80">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 min-h-[80vh] items-center py-16 md:py-24">
          <motion.div
            className="relative lg:col-span-6 flex items-center justify-center order-2 lg:order-1"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="relative w-full h-[400px] md:h-[500px] lg:h-[600px]">
              <Image
                src="/bot.png"
                alt="AI Бот Ассистент"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                loading="lazy"
                className="object-contain scale-x-[-1] mix-blend-multiply"
              />
              <div className="absolute inset-0 bg-gradient-radial from-sky-400/20 via-transparent to-transparent blur-3xl -z-10" />
            </div>
          </motion.div>

          <div className="lg:col-span-6 flex flex-col justify-center order-1 lg:order-2">
            <InView variants={blurFadeVariants} transition={{ duration: 0.5, ease: "easeOut" }} viewOptions={{ once: true, margin: "-50px" }}>
              <p className="text-sm text-zinc-500 mb-4 tracking-wider uppercase">{l.s3Eyebrow}</p>
            </InView>

            <InView variants={blurFadeVariants} transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} viewOptions={{ once: true, margin: "-50px" }}>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-zinc-900 leading-[1.1] mb-6">
                {l.s3TitleLine1}
                <br />
                <span className="text-sky-600">{l.s3TitleLine2}</span>
              </h2>
            </InView>

            <InView variants={blurFadeVariants} transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }} viewOptions={{ once: true, margin: "-50px" }}>
              <p className="text-lg md:text-xl text-zinc-600 leading-relaxed mb-8 max-w-lg">
                {l.s3Lead}
              </p>
            </InView>

            <motion.div className="space-y-4 mb-10" initial="hidden" whileInView="visible" viewport={{ once: true }}>
              {features.map((feature, index) => (
                <InView
                  key={index}
                  variants={blurFadeVariants}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 + index * 0.1 }}
                  viewOptions={{ once: true, margin: "-30px" }}
                >
                  <div className="flex items-center gap-4 group">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center group-hover:bg-sky-200 transition-colors">
                      <HugeiconsIcon icon={feature.icon} size={20} className="text-sky-600" />
                    </div>
                    <span className="text-zinc-700 font-medium">{feature.text}</span>
                  </div>
                </InView>
              ))}
            </motion.div>

            <InView variants={blurFadeVariants} transition={{ duration: 0.6, ease: "easeOut", delay: 0.6 }} viewOptions={{ once: true, margin: "-50px" }}>
              <div className="flex flex-wrap items-center gap-4">
                <motion.a
                  href="/login"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-sky-600 text-white text-sm font-medium rounded-full hover:bg-sky-700 transition-all duration-300 hover:shadow-lg hover:shadow-sky-200/50 group whitespace-nowrap"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <HugeiconsIcon icon={Message01Icon} size={20} />
                  {l.s3CtaTry}
                  <HugeiconsIcon icon={ArrowRight01Icon} size={18} className="transition-transform group-hover:translate-x-1" />
                </motion.a>

                <a
                  href="/#section-contact"
                  className="inline-flex items-center gap-2 px-6 py-4 bg-zinc-200/80 text-zinc-700 text-sm font-medium rounded-full hover:bg-zinc-300 transition-all duration-300 whitespace-nowrap"
                >
                  {l.s3CtaSelfHost}
                </a>
              </div>
            </InView>
          </div>
        </div>
      </div>
    </section>
  );
}
